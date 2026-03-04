/**
 * ChapterGenerator — Genera capitoli dinamici con NanoGPT
 * - Rate limit: 5 capitoli/giorno/tema
 * - Lock per evitare generazione concorrente
 * - Genera immagini per ogni scena
 */

import { createAdminClient } from "@/lib/supabase/admin-singleton"
import { chatCompletion, generateImage, getChatModel, getImageModel } from "@/lib/ai/nanogpt-client"
import { QueryCache } from "@/lib/cache/query-cache"
import type { StoryChapter } from "./story-manager"

const MAX_CHAPTERS_PER_DAY_GLOBAL = 5
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

    // Global limit: count ALL chapters generated today across ALL themes
    const { count, error } = await supabase
        .from("chapter_generation_daily")
        .select("*", { count: "exact", head: true })
        .gte("generated_at", todayStart.toISOString())

    if (error) {
        console.error("[ChapterGenerator] Error checking daily limit:", error)
        return { allowed: false, remaining: 0 }
    }

    const used = count || 0
    const remaining = Math.max(0, MAX_CHAPTERS_PER_DAY_GLOBAL - used)

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
Devi generare un nuovo capitolo per il tema "${theme}" seguendo ESATTAMENTE questa struttura:

STRUTTURA RIGIDA OBBLIGATORIA:
- 8 scene indicizzate 0-7
- Scene 0, 2, 4, 6: SOLO testo narrativo (intermezzi senza scelte)
- Scene 1, 3, 5, 7: testo + ESATTAMENTE 2 scelte (A e B). Ogni scelta deve avere: "id", "label" (testo da mostrare nel bottone), "pp_delta" ∈ {3,4,5,6}, "goto".
- Finale con "text" e "nextChapter" (ATTENZIONE: nextChapter DEVE essere una stringa, es. "2" o "tema_2", mai un numero intero).

REGOLE SCELTE (CRITICHE):
- Ogni scena con scelte DEVE avere ESATTAMENTE 2 scelte, NON 3, NON 1, SOLO 2
- Le scelte devono avere id "A" e "B"
- Ogni scelta DEVE avere una "label" (stringa) fighissima e psichedelica
- pp_delta DEVE essere 3, 4, 5 oppure 6 (SOLO questi valori)
- Scene 1, 3, 5: goto deve puntare alla scena successiva (2, 4, 6)
- Scena 7: goto deve essere -1 (indica finale)

STILE:
- Usa emoji e formattazione HTML <b>, <i>
- Mantieni il tono psichedelico, positivo, filosofico del King of Carts
- Usa i placeholder {{KING}}, {{PLAYER}}, {{TOTAL_PP}}, {{RANK}}, {{TITLE}}, {{THEME_CHAPTERS}}, {{THEME_EMOJI}}
- Tono in seconda persona: parla direttamente al giocatore come "tu"
- Testi coinvolgenti e immersivi

PER OGNI SCENA genera anche un campo "image_prompt" con una descrizione BREVE in inglese per generare un'immagine di sfondo della scena.

Genera SOLO il JSON valido del capitolo, senza commenti, markdown o spiegazioni.`

    const userPrompt = `Genera il capitolo ${chapterNumber} per il tema "${theme}".
Il JSON deve contenere: id, title, scenes (8), finale.
IMPORTANTE: ogni scena con scelte DEVE avere ESATTAMENTE 2 scelte (A e B), ognuna con una "label" (testo stringa), MAI 3 scelte. "nextChapter" nel finale deve essere una stringa.
Rispondi SOLO con JSON valido.`

    const MAX_ATTEMPTS = 2

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            console.log(`[ChapterGenerator] Attempt ${attempt}/${MAX_ATTEMPTS} for ${theme} chapter ${chapterNumber}`)

            const result = await chatCompletion({
                model: getChatModel(),
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                temperature: attempt === 1 ? 0.7 : 0.5, // Lower temperature on retry
                maxTokens: 4000,
            })

            const content = result.choices?.[0]?.message?.content
            if (!content) {
                console.error("[ChapterGenerator] No content from AI")
                continue
            }

            // Parse JSON (handle potential markdown wrapping)
            const cleanJson = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim()
            let parsed: GeneratedChapterContent = JSON.parse(cleanJson)

            // Auto-repair common AI mistakes before validation
            parsed = repairChapterStructure(parsed)

            // Validate structure
            if (!validateChapterStructure(parsed)) {
                console.error(`[ChapterGenerator] Invalid chapter structure on attempt ${attempt}`)
                if (attempt < MAX_ATTEMPTS) {
                    console.log("[ChapterGenerator] Retrying...")
                    continue
                }
                return null
            }

            // Override ID to be consistent
            parsed.id = `${theme}_${chapterNumber}`

            return parsed
        } catch (error) {
            console.error(`[ChapterGenerator] AI generation failed on attempt ${attempt}:`, error)
            if (attempt < MAX_ATTEMPTS) {
                console.log("[ChapterGenerator] Retrying...")
                continue
            }
            return null
        }
    }

    return null
}

// ─── Auto-Repair ────────────────────────────────────────────────────

function repairChapterStructure(chapter: GeneratedChapterContent): GeneratedChapterContent {
    console.log("[ChapterGenerator] Attempting auto-repair of chapter structure...")

    // 1. Fix scene count: take first 8 or pad
    if (chapter.scenes.length > 8) {
        chapter.scenes = chapter.scenes.slice(0, 8)
    }

    // 2. Fix scene indices (force 0-7 in order)
    chapter.scenes.forEach((scene, i) => {
        if (scene.index !== i) {
            console.log(`[ChapterGenerator] Repair: scene at position ${i} had index ${scene.index}, fixed to ${i}`)
            scene.index = i
        }
    })

    // 2.5 Fix nextChapter format (force to string)
    if (chapter.finale && typeof chapter.finale.nextChapter === "number") {
        console.log(`[ChapterGenerator] Repair: nextChapter ${chapter.finale.nextChapter} was a number, casting to string`)
        chapter.finale.nextChapter = String(chapter.finale.nextChapter)
    }

    const CHOICE_SCENES = [1, 3, 5, 7]
    const INTERLUDE_SCENES = [0, 2, 4, 6]

    // 3. Fix choice scenes
    for (const sceneIndex of CHOICE_SCENES) {
        const scene = chapter.scenes[sceneIndex]
        if (!scene) continue

        if (!scene.choices || scene.choices.length === 0) {
            // Generate default choices if completely missing
            console.log(`[ChapterGenerator] Repair: scene ${sceneIndex} missing choices, adding defaults`)
            const gotoValue = sceneIndex === 7 ? -1 : sceneIndex + 1
            scene.choices = [
                { id: "A", label: "🎭 Prima scelta", pp_delta: 4, goto: gotoValue },
                { id: "B", label: "✨ Seconda scelta", pp_delta: 3, goto: gotoValue },
            ]
        } else if (scene.choices.length > 2) {
            // Truncate to 2 choices (keep A and B)
            console.log(`[ChapterGenerator] Repair: scene ${sceneIndex} had ${scene.choices.length} choices, truncated to 2`)
            scene.choices = scene.choices.slice(0, 2)
        }

        // Fix choice IDs and labels
        if (scene.choices.length >= 2) {
            scene.choices[0].id = "A"
            if (!scene.choices[0].label) scene.choices[0].label = "Segui questo percorso"
            scene.choices[1].id = "B"
            if (!scene.choices[1].label) scene.choices[1].label = "Esplora un'altra via"
        }

        // Fix goto values
        const expectedGoto = sceneIndex === 7 ? -1 : sceneIndex + 1
        for (const choice of scene.choices) {
            if (choice.goto !== expectedGoto) {
                console.log(`[ChapterGenerator] Repair: scene ${sceneIndex} choice ${choice.id} goto ${choice.goto} → ${expectedGoto}`)
                choice.goto = expectedGoto
            }
            // Clamp pp_delta to valid values
            if (!VALID_PP_VALUES.includes(choice.pp_delta)) {
                const clamped = Math.max(3, Math.min(6, Math.round(choice.pp_delta)))
                const validClamped = VALID_PP_VALUES.includes(clamped) ? clamped : 4
                console.log(`[ChapterGenerator] Repair: pp_delta ${choice.pp_delta} → ${validClamped}`)
                choice.pp_delta = validClamped
            }
        }
    }

    // 4. Remove choices from interlude scenes
    for (const sceneIndex of INTERLUDE_SCENES) {
        const scene = chapter.scenes[sceneIndex]
        if (scene?.choices && scene.choices.length > 0) {
            console.log(`[ChapterGenerator] Repair: removed choices from interlude scene ${sceneIndex}`)
            delete scene.choices
        }
    }

    return chapter
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
): Promise<{ imageUrls: Record<number, string> }> {
    const imageUrls: Record<number, string> = {}

    // Generate images for all scenes in parallel
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
            }
        } catch (error) {
            console.error(`[ChapterGenerator] Image generation failed for scene ${scene.index}:`, error)
        }
    })

    await Promise.all(imagePromises)

    return { imageUrls }
}

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

    // Build content with embedded media URLs
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

    // 1. Check daily rate limit
    const { allowed, remaining } = await checkDailyLimit()
    if (!allowed) {
        console.log(`[ChapterGenerator] Daily limit reached for theme ${theme}`)
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

        // 4. Generate media (images)
        const { imageUrls } = await generateSceneMedia(chapterContent.scenes)

        // 5. Save to database
        const saved = await saveChapterToDatabase(theme, chapterNumber, chapterContent, imageUrls)
        if (!saved) {
            console.error("[ChapterGenerator] Failed to save chapter")
            return null
        }

        console.log(`[ChapterGenerator] Chapter ${chapterNumber} for ${theme} generated (${remaining - 1} remaining today)`)

        // 6. Return as StoryChapter
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
 * Check if a theme has reached its daily generation limit.
 * Returns { allowed, remaining, message }.
 */
export async function getDailyLimitStatus(): Promise<{
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
            : `Hai raggiunto il limite di ${MAX_CHAPTERS_PER_DAY_GLOBAL} capitoli generati oggi. Riprova domani!`,
    }
}
