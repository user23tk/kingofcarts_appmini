/**
 * ChapterGenerator — Genera capitoli dinamici con NanoGPT
 * - Rate limit: 5 capitoli/giorno TOTALI (cross-tema)
 * - Lock per evitare generazione concorrente
 * - Genera immagini di background per ogni scena
 */

import { createAdminClient } from "@/lib/supabase/admin-singleton"
import { chatCompletion, generateImage, getChatModel, getImageModel } from "@/lib/ai/nanogpt-client"
import { QueryCache } from "@/lib/cache/query-cache"
import type { StoryChapter } from "./story-manager"

const MAX_CHAPTERS_PER_DAY = 5
const LOCK_TIMEOUT_MS = 120_000 // 2 minutes
const VALID_PP_VALUES = [3, 4, 5, 6]

interface GeneratedScene {
    index: number
    text: string
    image_prompt: string
    choices?: Array<{
        id: string
        label: string
        pp_delta: number
        goto: number
    }>
}

interface GeneratedChapterContent {
    id: string
    title: string
    scenes: GeneratedScene[]
    finale: {
        text: string
        nextChapter: string
    }
}

// ─── Rate Limit Check ───────────────────────────────────────────────

async function checkDailyLimit(): Promise<{ allowed: boolean; remaining: number }> {
    const supabase = createAdminClient()

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    // Conta TUTTI i capitoli generati oggi (cross-tema)
    const { count, error } = await supabase
        .from("chapter_generation_daily")
        .select("*", { count: "exact", head: true })
        .gte("generated_at", todayStart.toISOString())

    if (error) {
        console.error("[ChapterGenerator] Error checking daily limit:", error)
        return { allowed: false, remaining: 0 }
    }

    const used = count || 0
    const remaining = Math.max(0, MAX_CHAPTERS_PER_DAY - used)

    return { allowed: remaining > 0, remaining }
}

// ─── Lock Management ────────────────────────────────────────────────

async function acquireLock(theme: string, chapterNumber: number): Promise<boolean> {
    const supabase = createAdminClient()
    const lockKey = `${theme}:${chapterNumber}`

    // Clean expired locks first
    await supabase
        .from("chapter_generation_locks")
        .delete()
        .lt("expires_at", new Date().toISOString())

    // Try to insert lock
    const { error } = await supabase
        .from("chapter_generation_locks")
        .insert({
            lock_key: lockKey,
            expires_at: new Date(Date.now() + LOCK_TIMEOUT_MS).toISOString(),
        })

    if (error) {
        // Lock already exists (another generation in progress)
        console.log(`[ChapterGenerator] Lock already held for ${lockKey}`)
        return false
    }

    return true
}

async function releaseLock(theme: string, chapterNumber: number): Promise<void> {
    const supabase = createAdminClient()
    const lockKey = `${theme}:${chapterNumber}`

    await supabase
        .from("chapter_generation_locks")
        .delete()
        .eq("lock_key", lockKey)
}

// ─── AI Generation ──────────────────────────────────────────────────

async function generateChapterContent(
    theme: string,
    chapterNumber: number
): Promise<GeneratedChapterContent | null> {
    const systemPrompt = `Sei un creatore di storie interattive per il bot Telegram "King of Carts".
Devi generare un nuovo capitolo per il tema "${theme}" seguendo ESATTAMENTE questa struttura JSON.

ESEMPIO STRUTTURA JSON OBBLIGATORIA:
{
  "id": "${theme}_${chapterNumber}",
  "title": "🎡 Titolo evocativo con emoji",
  "finale": {
    "text": "Testo finale con {{PLAYER}} e {{TOTAL_PP}}...",
    "nextChapter": "${theme}_${chapterNumber + 1}"
  },
  "scenes": [
    {
      "text": "Testo narrativo lungo e coinvolgente con {{PLAYER}} e emoji... 🌌",
      "index": 0,
      "image_prompt": "English description for background image generation"
    },
    {
      "text": "Testo che introduce una scelta con {{PLAYER}}...",
      "index": 1,
      "image_prompt": "English description for background image",
      "choices": [
        {"id": "A", "goto": 2, "label": "Prima scelta con emoji 🌟", "pp_delta": 5},
        {"id": "B", "goto": 2, "label": "Seconda scelta con emoji ⚡", "pp_delta": 3}
      ]
    },
    {
      "text": "Testo narrativo intermezzo... 🫂",
      "index": 2,
      "image_prompt": "English description"
    },
    {
      "text": "Testo che introduce una scelta...",
      "index": 3,
      "image_prompt": "English description",
      "choices": [
        {"id": "A", "goto": 4, "label": "Scelta A 💃", "pp_delta": 6},
        {"id": "B", "goto": 4, "label": "Scelta B ☔", "pp_delta": 4}
      ]
    },
    {
      "text": "Testo narrativo con {{KING}}... ✨",
      "index": 4,
      "image_prompt": "English description"
    },
    {
      "text": "Testo che introduce una scelta...",
      "index": 5,
      "image_prompt": "English description",
      "choices": [
        {"id": "A", "goto": 6, "label": "Scelta A 🪞", "pp_delta": 3},
        {"id": "B", "goto": 6, "label": "Scelta B 😊", "pp_delta": 4}
      ]
    },
    {
      "text": "Testo narrativo intermezzo... 🎟️",
      "index": 6,
      "image_prompt": "English description"
    },
    {
      "text": "Testo che introduce l'ultima scelta...",
      "index": 7,
      "image_prompt": "English description",
      "choices": [
        {"id": "A", "goto": -1, "label": "Scelta finale A 🎫", "pp_delta": 6},
        {"id": "B", "goto": -1, "label": "Scelta finale B 🎁", "pp_delta": 5}
      ]
    }
  ]
}

REGOLE IMPORTANTI:
- Scene 0, 2, 4, 6: SOLO testo narrativo, NESSUN campo "choices"
- Scene 1, 3, 5, 7: testo + ESATTAMENTE 2 scelte (id "A" e "B") con pp_delta ∈ {3, 4, 5, 6}
- Scene 1, 3, 5: goto punta alla scena successiva (2, 4, 6)
- Scena 7: goto DEVE essere -1
- Ogni scena DEVE avere i campi "text", "index" (0-7) e "image_prompt" (in inglese)
- Le scelte hanno SEMPRE id "A" e "B"

STILE:
- Usa emoji e formattazione HTML <b>, <i>
- Tono psichedelico, positivo, filosofico del King of Carts
- Placeholder: {{KING}}, {{PLAYER}}, {{TOTAL_PP}}, {{RANK}}, {{TITLE}}, {{THEME_CHAPTERS}}, {{THEME_EMOJI}}
- Seconda persona: parla al giocatore come "tu"
- Testi lunghi, coinvolgenti e immersivi (almeno 3-4 frasi per scena)

Genera SOLO il JSON valido, senza commenti, markdown o spiegazioni.`

    const userPrompt = `Genera il capitolo ${chapterNumber} per il tema "${theme}".
Rispondi con SOLO il JSON valido seguendo esattamente lo schema fornito. Non aggiungere nulla prima o dopo il JSON.`

    try {
        const result = await chatCompletion({
            model: getChatModel(),
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            temperature: 0.7,
            maxTokens: 6000,
        })

        const content = result.choices?.[0]?.message?.content
        if (!content) {
            console.error("[ChapterGenerator] No content from AI")
            return null
        }

        // Parse JSON (handle potential markdown wrapping)
        const cleanJson = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim()
        const parsed: GeneratedChapterContent = JSON.parse(cleanJson)

        // Validate structure
        if (!validateChapterStructure(parsed)) {
            console.error("[ChapterGenerator] Invalid chapter structure")
            return null
        }

        // Override ID to be consistent
        parsed.id = `${theme}_${chapterNumber}`

        return parsed
    } catch (error) {
        console.error("[ChapterGenerator] AI generation failed:", error)
        return null
    }
}

// ─── Validation ─────────────────────────────────────────────────────

function validateChapterStructure(chapter: GeneratedChapterContent): boolean {
    if (!chapter.title || !chapter.scenes || !chapter.finale) {
        console.error("[ChapterGenerator] Missing required fields")
        return false
    }

    if (chapter.scenes.length !== 8) {
        console.error(`[ChapterGenerator] Expected 8 scenes, got ${chapter.scenes.length}`)
        return false
    }

    // Validate choice scenes (1, 3, 5, 7)
    for (const sceneIndex of [1, 3, 5, 7]) {
        const scene = chapter.scenes.find((s) => s.index === sceneIndex)
        if (!scene?.choices || scene.choices.length !== 2) {
            console.error(`[ChapterGenerator] Scene ${sceneIndex} must have exactly 2 choices`)
            return false
        }

        for (const choice of scene.choices) {
            if (!VALID_PP_VALUES.includes(choice.pp_delta)) {
                console.error(`[ChapterGenerator] Invalid pp_delta ${choice.pp_delta} in scene ${sceneIndex}`)
                return false
            }
        }
    }

    // Validate interlude scenes (0, 2, 4, 6) should NOT have choices
    for (const sceneIndex of [0, 2, 4, 6]) {
        const scene = chapter.scenes.find((s) => s.index === sceneIndex)
        if (scene?.choices && scene.choices.length > 0) {
            console.error(`[ChapterGenerator] Scene ${sceneIndex} should not have choices`)
            return false
        }
    }

    return true
}

// ─── Media Generation ───────────────────────────────────────────────

async function generateSceneMedia(
    scenes: GeneratedScene[]
): Promise<Record<number, string>> {
    const imageUrls: Record<number, string> = {}

    // Generate background images for all scenes in parallel
    const imagePromises = scenes.map(async (scene) => {
        if (!scene.image_prompt) return

        try {
            const result = await generateImage({
                prompt: `${scene.image_prompt}, digital art, vibrant colors, fantasy game style, high quality`,
                model: getImageModel(),
                size: "1024x1024",
            })

            if (result.data?.[0]?.url) {
                imageUrls[scene.index] = result.data[0].url
                console.log(`[ChapterGenerator] Image generated for scene ${scene.index}`)
            } else {
                console.warn(`[ChapterGenerator] structured response OK but no URL for scene ${scene.index}`, result)
            }
        } catch (error) {
            console.error(`[ChapterGenerator] Image generation failed for scene ${scene.index}:`, error)
        }
    })

    await Promise.all(imagePromises)

    return imageUrls
}

// ─── Save to Database ───────────────────────────────────────────────

async function saveChapterToDatabase(
    theme: string,
    chapterNumber: number,
    chapter: GeneratedChapterContent,
    imageUrls: Record<number, string>
): Promise<boolean> {
    const supabase = createAdminClient()

    // Get theme ID
    const { data: themeData } = await supabase
        .from("themes")
        .select("id")
        .eq("name", theme)
        .single()

    if (!themeData) {
        console.error(`[ChapterGenerator] Theme not found: ${theme}`)
        return false
    }

    // Build content with embedded background image URLs
    const contentWithMedia = {
        scenes: chapter.scenes.map((scene) => ({
            index: scene.index,
            text: scene.text,
            choices: scene.choices?.map((c) => ({
                id: c.id,
                label: c.label,
                pp_delta: c.pp_delta,
                goto: c.goto,
            })),
            background_image_url: imageUrls[scene.index] || null,
        })),
        finale: chapter.finale,
    }

    const { error } = await supabase
        .from("story_chapters")
        .insert({
            theme_id: themeData.id,
            chapter_number: chapterNumber,
            title: chapter.title,
            content: contentWithMedia,
            is_active: true,
            is_generated: true,
        })

    if (error) {
        console.error("[ChapterGenerator] Failed to save chapter:", error)
        return false
    }

    // Record daily generation
    await supabase.from("chapter_generation_daily").insert({
        theme,
        chapter_number: chapterNumber,
    })

    // Invalidate caches
    QueryCache.invalidate(`chapters_count:${theme}`)
    QueryCache.invalidate(`chapter:${theme}:${chapterNumber}`)

    console.log(`[ChapterGenerator] Chapter ${chapterNumber} saved for theme ${theme}`)
    return true
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Generate a new chapter for a theme, with rate limiting and locking.
 * Returns the generated chapter or null if generation is not possible.
 */
export async function generateChapter(
    theme: string,
    chapterNumber: number
): Promise<StoryChapter | null> {
    console.log(`[ChapterGenerator] Generating chapter ${chapterNumber} for theme ${theme}`)

    // 1. Check global daily rate limit (5 chapters/day across all themes)
    const { allowed, remaining } = await checkDailyLimit()
    if (!allowed) {
        console.log(`[ChapterGenerator] Global daily limit reached`)
        return null
    }

    // 2. Acquire lock
    const locked = await acquireLock(theme, chapterNumber)
    if (!locked) {
        console.log(`[ChapterGenerator] Could not acquire lock, generation already in progress`)
        return null
    }

    try {
        // 3. Generate chapter content via AI
        const chapterContent = await generateChapterContent(theme, chapterNumber)
        if (!chapterContent) {
            console.error("[ChapterGenerator] AI generation returned null")
            return null
        }

        // 4. Generate background images for all scenes in parallel
        const imageUrls = await generateSceneMedia(chapterContent.scenes)

        // 5. Save to database
        const saved = await saveChapterToDatabase(theme, chapterNumber, chapterContent, imageUrls)
        if (!saved) {
            console.error("[ChapterGenerator] Failed to save chapter")
            return null
        }

        console.log(`[ChapterGenerator] Chapter ${chapterNumber} for ${theme} generated (${remaining - 1} remaining today)`)

        // 6. Return as StoryChapter with image URLs
        return {
            id: chapterContent.id,
            title: chapterContent.title,
            scenes: chapterContent.scenes.map((s) => ({
                index: s.index,
                text: s.text,
                choices: s.choices?.map((c) => ({
                    id: c.id,
                    label: c.label,
                    pp_delta: c.pp_delta,
                })) || [],
                background_image_url: imageUrls[s.index] || null,
            })),
            finale: {
                text: chapterContent.finale.text,
                nextChapter: chapterContent.finale.nextChapter,
            },
        }
    } finally {
        // 7. Always release lock
        await releaseLock(theme, chapterNumber)
    }
}

/**
 * Check if the global daily generation limit has been reached.
 * Returns { allowed, remaining, message }.
 */
export async function getDailyLimitStatus(theme: string): Promise<{
    allowed: boolean
    remaining: number
    message: string
}> {
    const { allowed, remaining } = await checkDailyLimit()

    return {
        allowed,
        remaining,
        message: allowed
            ? `Puoi generare ancora ${remaining} capitoli oggi.`
            : `Hai raggiunto il limite di ${MAX_CHAPTERS_PER_DAY} capitoli generati oggi. Riprova domani!`,
    }
}
