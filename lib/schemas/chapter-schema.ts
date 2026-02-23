import { z } from "zod"
import { GAME_CONSTANTS } from "@/lib/constants/game"

export const ChoiceSchema = z.object({
  id: z.enum(["A", "B", "C"]),
  label: z.string().min(1, "Label non può essere vuota"),
  pp_delta: z.number().int().min(GAME_CONSTANTS.PP_MIN).max(GAME_CONSTANTS.PP_MAX),
  goto: z.number().int().min(-1),
})

export const SceneSchema = z.object({
  index: z.number().int().min(GAME_CONSTANTS.SCENE_MIN_INDEX).max(GAME_CONSTANTS.SCENE_FINAL_INDEX),
  text: z.string().min(1, "Testo scena non può essere vuoto"),
  image_prompt: z.string().optional(),
  choices: z.array(ChoiceSchema).optional(),
})

// Schema per il finale
export const FinaleSchema = z.object({
  text: z.string().min(1, "Testo finale non può essere vuoto"),
  nextChapter: z.string().min(1, "NextChapter deve essere specificato"),
  choices: z.array(ChoiceSchema.omit({ goto: true })).optional(), // Scelte finali senza goto
})

// Schema per un capitolo completo
export const ChapterSchema = z.object({
  id: z.string().min(1, "ID capitolo richiesto"),
  title: z.string().min(1, "Titolo capitolo richiesto"),
  scenes: z.array(SceneSchema).length(8, "Devono esserci esattamente 8 scene (0-7)"),
  finale: FinaleSchema,
})

// Funzione per calcolare similarità testuale
const calculateSimilarity = (text1: string, text2: string): number => {
  const words1 = text1.toLowerCase().split(/\s+/)
  const words2 = text2.toLowerCase().split(/\s+/)

  const set1 = new Set(words1)
  const set2 = new Set(words2)

  const intersection = new Set([...set1].filter((x) => set2.has(x)))
  const union = new Set([...set1, ...set2])

  return intersection.size / union.size // Jaccard similarity
}

// Validazione di varietà tra capitoli
export const validateChapterVariety = (newChapter: any, existingChapters: Chapter[] = []) => {
  const SIMILARITY_THRESHOLD = 0.3 // 30% di similarità massima

  for (const existing of existingChapters) {
    // Controlla similarità del titolo
    const titleSimilarity = calculateSimilarity(newChapter.title, existing.title)
    if (titleSimilarity > SIMILARITY_THRESHOLD) {
      throw new Error(
        `Titolo troppo simile al capitolo esistente "${existing.title}" (${Math.round(titleSimilarity * 100)}% similarità)`,
      )
    }

    // Controlla similarità delle scene principali (scene con scelte)
    const keyScenes = [1, 3, 5, GAME_CONSTANTS.SCENE_FINAL_INDEX]
    for (const sceneIndex of keyScenes) {
      const newScene = newChapter.scenes[sceneIndex]
      const existingScene = existing.scenes[sceneIndex]

      if (newScene && existingScene) {
        const sceneSimilarity = calculateSimilarity(newScene.text, existingScene.text)
        if (sceneSimilarity > SIMILARITY_THRESHOLD) {
          throw new Error(
            `Scena ${sceneIndex} troppo simile al capitolo "${existing.title}" (${Math.round(sceneSimilarity * 100)}% similarità)`,
          )
        }
      }
    }

    // Controlla similarità del finale
    const finaleSimilarity = calculateSimilarity(newChapter.finale.text, existing.finale.text)
    if (finaleSimilarity > SIMILARITY_THRESHOLD) {
      throw new Error(
        `Finale troppo simile al capitolo "${existing.title}" (${Math.round(finaleSimilarity * 100)}% similarità)`,
      )
    }
  }

  return true
}

// Funzione per validare la struttura delle scene
export const validateChapterStructure = (chapter: any, existingChapters: Chapter[] = []) => {
  const parsed = ChapterSchema.parse(chapter)

  validateChapterVariety(parsed, existingChapters)

  const scenes = parsed.scenes

  scenes.forEach((scene, i) => {
    if (scene.index !== i) {
      throw new Error(`Scena ${i} deve avere index ${i}, trovato ${scene.index}`)
    }
  })

  scenes.forEach((scene) => {
    const shouldHaveChoices = [1, 3, 5, GAME_CONSTANTS.SCENE_FINAL_INDEX].includes(scene.index)
    const hasChoices = scene.choices && scene.choices.length > 0

    if (shouldHaveChoices && !hasChoices) {
      throw new Error(`Scena ${scene.index} deve avere scelte`)
    }

    if (!shouldHaveChoices && hasChoices) {
      throw new Error(`Scena ${scene.index} non deve avere scelte`)
    }

    if (hasChoices && scene.choices!.length !== GAME_CONSTANTS.SCENE_CHOICES_COUNT) {
      throw new Error(`Scena ${scene.index} deve avere esattamente ${GAME_CONSTANTS.SCENE_CHOICES_COUNT} scelte`)
    }

    if (hasChoices) {
      scene.choices!.forEach((choice) => {
        if (scene.index === GAME_CONSTANTS.SCENE_FINAL_INDEX) {
          if (choice.goto !== GAME_CONSTANTS.SCENE_FINAL_GOTO) {
            throw new Error(
              `Scena ${GAME_CONSTANTS.SCENE_FINAL_INDEX} deve avere goto: ${GAME_CONSTANTS.SCENE_FINAL_GOTO}, trovato ${choice.goto}`,
            )
          }
        } else {
          const expectedGoto = scene.index + 1
          if (choice.goto !== expectedGoto) {
            throw new Error(`Scena ${scene.index} deve avere goto: ${expectedGoto}, trovato ${choice.goto}`)
          }
        }
      })
    }
  })

  return parsed
}

export type Chapter = z.infer<typeof ChapterSchema>
export type Scene = z.infer<typeof SceneSchema>
export type Choice = z.infer<typeof ChoiceSchema>
export type Finale = z.infer<typeof FinaleSchema>
