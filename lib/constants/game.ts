/**
 * Costanti di gioco centralizzate
 * Evita magic numbers sparsi nel codice
 */
export const GAME_CONSTANTS = {
  // PP (Progress Points)
  PP_MIN: 3,
  PP_MAX: 6,
  PP_EVENT_MULTIPLIER_MIN: 1,
  PP_EVENT_MULTIPLIER_MAX: 5,

  // Scenes
  SCENE_MIN_INDEX: 0,
  SCENE_MAX_INDEX: 9,
  SCENE_FINAL_INDEX: 7,
  SCENE_CHOICES_COUNT: 2,
  SCENE_FINAL_GOTO: -1,

  // Chapters
  CHAPTER_MIN: 1,
  CHAPTER_SCENES_COUNT: 8,

  // Rate Limiting
  RATE_LIMIT_DAILY_MAX: Number.parseInt(process.env.RATE_LIMIT_DAILY_MAX || "50", 10),
  RATE_LIMIT_HOURLY_MAX: Number.parseInt(process.env.RATE_LIMIT_HOURLY_MAX || "10", 10),
  RATE_LIMIT_BURST_MAX: Number.parseInt(process.env.RATE_LIMIT_BURST_MAX || "3", 10),
  RATE_LIMIT_BURST_WINDOW_SECONDS: Number.parseInt(process.env.RATE_LIMIT_BURST_WINDOW_SECONDS || "60", 10),

  // Events
  EVENT_MAX_DURATION_DAYS: 365,

  // Leaderboard
  LEADERBOARD_DEFAULT_LIMIT: 100,
  LEADERBOARD_TOP_PLAYERS: 10,

  // Cache
  INLINE_CACHE_TIME: Number.parseInt(process.env.INLINE_CACHE_TIME || "300", 10),

  // Callback
  CALLBACK_TOKEN_EXPIRY_MINUTES: Number.parseInt(process.env.CALLBACK_TOKEN_EXPIRY_MINUTES || "5", 10),
} as const

export type GameConstantKey = keyof typeof GAME_CONSTANTS
