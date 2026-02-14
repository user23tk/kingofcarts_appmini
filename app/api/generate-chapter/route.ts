import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { requireDebugAuth } from "@/lib/security/debug-auth"
import { chatCompletion, generateImage, generateVideo, getChatModel, getImageModel, getVideoModel } from "@/lib/ai/nanogpt-client"
import { createAdminClient } from "@/lib/supabase/admin-singleton"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const auth = await requireDebugAuth(request)
    if (!auth.authorized) {
      return auth.response!
    }

    const { theme, chapterNumber, saveToDb } = await request.json()

    if (!theme) {
      return NextResponse.json({ error: "Theme is required" }, { status: 400 })
    }

    const systemPrompt = `Sei un creatore di storie interattive per il bot Telegram "King of Carts". 
Devi generare un nuovo capitolo per il tema "${theme}" seguendo ESATTAMENTE questa struttura:

STRUTTURA RIGIDA OBBLIGATORIA:
- 8 scene indicizzate 0-7
- Scene 0, 2, 4, 6: SOLO testo narrativo (intermezzi senza scelte)
- Scene 1, 3, 5, 7: testo + 2 scelte (A/B) con pp_delta ∈ {3,4,5,6}
- Goto logic: scene 1/3/5 → scena successiva (2/4/6), scena 7 → goto: -1
- Finale con testo + nextChapter

REGOLE SCELTE:
- Ogni scelta deve avere pp_delta tra 3-6 (SOLO valori positivi: 3, 4, 5, o 6)
- Scene 1, 3, 5: goto deve puntare alla scena successiva (2, 4, 6)
- Scena 7: goto deve essere -1 (indica finale)

STILE:
- Usa emoji e formattazione HTML <b>, <i>
- Mantieni il tono psichedelico, positivo, filosofico del King of Carts
- Usa i placeholder {{KING}}, {{PLAYER}}, {{TOTAL_PP}}, {{RANK}}, {{TITLE}}, {{THEME_CHAPTERS}}, {{THEME_EMOJI}}
- Tono in seconda persona: parla direttamente al giocatore come "tu"
- Testi coinvolgenti e immersivi

PER OGNI SCENA genera anche un campo "image_prompt" con una descrizione breve in inglese per generare un'immagine di sfondo.
Per la scena 6 (penultimo intermezzo) aggiungi anche un campo "video_prompt" con una descrizione breve per un video di 5 secondi.

Genera SOLO il JSON del capitolo, senza spiegazioni.`

    const userPrompt = `Genera un nuovo capitolo per il tema "${theme}" (numero ${chapterNumber || "auto"}).

ESEMPIO STRUTTURA (DA RISPETTARE ESATTAMENTE):
{
  "id": "${theme}_${chapterNumber || "1"}",
  "title": "Titolo Accattivante",
  "scenes": [
    { "index": 0, "text": "🎭 <b>{{KING}}</b> ti accoglie... (INTRO - solo testo)", "image_prompt": "A mystical king on a golden throne in a fantasy realm" },
    { "index": 1, "text": "Prima scena con scelta...", "image_prompt": "Two glowing paths diverging in an enchanted forest", "choices": [
      { "id": "A", "label": "🗡️ Prima opzione", "pp_delta": 5, "goto": 2 },
      { "id": "B", "label": "🎵 Seconda opzione", "pp_delta": 3, "goto": 2 }
    ]},
    { "index": 2, "text": "Intermezzo narrativo... (solo testo)", "image_prompt": "A tranquil magical lake reflecting starlight" },
    { "index": 3, "text": "Seconda scena con scelta...", "image_prompt": "A crossroads with ancient stone markers", "choices": [
      { "id": "A", "label": "💎 Terza opzione", "pp_delta": 4, "goto": 4 },
      { "id": "B", "label": "🤝 Quarta opzione", "pp_delta": 6, "goto": 4 }
    ]},
    { "index": 4, "text": "Altro intermezzo... (solo testo)", "image_prompt": "A mystical cave with glowing crystals" },
    { "index": 5, "text": "Terza scena con scelta...", "image_prompt": "A towering challenge before the hero", "choices": [
      { "id": "A", "label": "🌀 Quinta opzione", "pp_delta": 3, "goto": 6 },
      { "id": "B", "label": "🛡️ Sesta opzione", "pp_delta": 4, "goto": 6 }
    ]},
    { "index": 6, "text": "Penultimo intermezzo... (solo testo)", "image_prompt": "Epic scene before the final battle", "video_prompt": "A dramatic cinematic zoom into a glowing portal with magical particles, 5 seconds, epic fantasy style" },
    { "index": 7, "text": "Scena finale con scelta...", "image_prompt": "The climactic moment of decision", "choices": [
      { "id": "A", "label": "🔥 Scelta finale A", "pp_delta": 6, "goto": -1 },
      { "id": "B", "label": "🌈 Scelta finale B", "pp_delta": 5, "goto": -1 }
    ]}
  ],
  "finale": {
    "text": "🏆 «Magnifico, {{PLAYER}}!» sorride <b>{{KING}}</b>. PP totali: {{TOTAL_PP}}.",
    "nextChapter": "${theme}_${Number.parseInt(chapterNumber || "1") + 1}"
  }
}

GENERA IL CAPITOLO SEGUENDO ESATTAMENTE QUESTA STRUTTURA.`

    const result = await chatCompletion({
      model: getChatModel(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      maxTokens: 4000,
    })

    const content = result.choices?.[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: "No content generated" }, { status: 500 })
    }

    // Parse JSON
    let parsed
    try {
      parsed = JSON.parse(content.replace(/```json?\n?/g, "").replace(/```/g, "").trim())
    } catch {
      return NextResponse.json({ raw: content, parseError: true })
    }

    // Generate images for each scene if requested
    const imageUrls: Record<number, string> = {}
    let videoUrl: string | null = null

    if (parsed.scenes) {
      const imagePromises = parsed.scenes.map(async (scene: { index: number; image_prompt?: string; video_prompt?: string }) => {
        // Image Generation
        if (scene.image_prompt) {
          try {
            const imgResult = await generateImage({
              model: getImageModel(),
              prompt: `${scene.image_prompt}, digital art, vibrant colors, fantasy game style, high quality`,
              size: "1024x1024",
            })
            if (imgResult.data?.[0]?.url) {
              imageUrls[scene.index] = imgResult.data[0].url
            }
          } catch (e) {
            console.error(`[generate-chapter] Image gen failed for scene ${scene.index}:`, e)
          }
        }

        // Video Generation (only for scene 6 or where video_prompt exists)
        if (scene.video_prompt && scene.index === 6) {
          try {
            const vUrl = await generateVideo({
              model: getVideoModel(),
              prompt: `${scene.video_prompt}, cinematic, 4k, epic fantasy`,
              duration: 5
            })
            if (vUrl) {
              videoUrl = vUrl
              console.log(`[generate-chapter] Video generated for scene ${scene.index}:`, vUrl)
            }
          } catch (e) {
            console.error(`[generate-chapter] Video gen failed for scene ${scene.index}:`, e)
          }
        }
      })
      await Promise.all(imagePromises)
    }

    // Save to database if requested
    let savedToDb = false
    if (saveToDb && parsed) {
      const supabase = createAdminClient()

      // Get theme ID
      const { data: themeData } = await supabase
        .from("themes")
        .select("id")
        .eq("name", theme)
        .single()

      if (themeData) {
        // Determine chapter number (auto-detect next available)
        let nextChapterNumber = chapterNumber
        if (!nextChapterNumber) {
          const { count } = await supabase
            .from("story_chapters")
            .select("*", { count: "exact", head: true })
            .eq("theme_id", themeData.id)
          nextChapterNumber = (count || 0) + 1
        }

        // Embed images into content
        const contentWithMedia = {
          scenes: parsed.scenes.map((s: any) => ({
            index: s.index,
            text: s.text,
            choices: s.choices?.map((c: any) => ({
              id: c.id,
              label: c.label,
              pp_delta: c.pp_delta,
              goto: c.goto,
            })),
            background_image_url: imageUrls[s.index] || null,
            video_url: s.index === 6 ? videoUrl : null,
          })),
          finale: parsed.finale,
        }

        const { error: insertError } = await supabase
          .from("story_chapters")
          .insert({
            theme_id: themeData.id,
            chapter_number: nextChapterNumber,
            title: parsed.title,
            content: contentWithMedia,
            is_active: true,
            is_generated: true,
          })

        if (insertError) {
          console.error("[generate-chapter] DB save error:", insertError)
          return NextResponse.json({
            chapter: parsed,
            imageUrls,
            dbError: insertError.message,
            savedToDb: false,
          })
        }

        savedToDb = true
        console.log(`[generate-chapter] Saved chapter ${nextChapterNumber} for theme ${theme}`)
      } else {
        return NextResponse.json({
          chapter: parsed,
          imageUrls,
          dbError: `Theme "${theme}" not found in database`,
          savedToDb: false,
        })
      }
    }

    return NextResponse.json({
      chapter: parsed,
      imageUrls,
      savedToDb,
      model: getChatModel(),
      imageModel: getImageModel(),
    })
  } catch (error) {
    console.error("Error generating chapter:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate chapter" },
      { status: 500 }
    )
  }
}
