/**
 * Messaggi di errore centralizzati per consistenza e i18n
 */
export const ERROR_MESSAGES = {
  // Authentication
  AUTH_UNAUTHORIZED: "Unauthorized",
  AUTH_INVALID_TOKEN: "Invalid token",
  AUTH_NO_TOKEN: "No token provided",
  AUTH_EXPIRED: "Auth data expired",
  AUTH_FAILED: "Authentication failed",
  AUTH_INVALID_HASH: "Invalid hash - data may be tampered",

  // Configuration
  CONFIG_BOT_TOKEN_MISSING: "Bot token not configured",
  CONFIG_WEBHOOK_SECRET_MISSING: "Webhook secret not configured",
  CONFIG_SERVER_ERROR: "Server configuration error",
  CONFIG_SUPABASE_URL_MISSING: "Missing NEXT_PUBLIC_SUPABASE_URL",
  CONFIG_SERVICE_ROLE_MISSING: "Missing SUPABASE_SERVICE_ROLE_KEY",

  // User
  USER_NOT_FOUND: "User not found",
  USER_ID_REQUIRED: "User ID required",
  USER_INVALID_FORMAT: "Invalid userId format",

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: "Rate limit exceeded",
  RATE_LIMIT_MESSAGE: "Too many requests. Please try again later.",

  // Story/Chapter
  STORY_CHAPTER_NOT_FOUND: "Chapter not found for theme",
  STORY_NO_SCENES: "Chapter has no scenes",
  STORY_INVALID_SCENE: "Invalid scene structure in database",
  STORY_FAILED_TO_START: "Failed to start story",

  // Theme
  THEME_INVALID: "Invalid theme",
  THEME_FETCH_FAILED: "Failed to fetch themes",

  // Leaderboard
  LEADERBOARD_FETCH_FAILED: "Failed to fetch leaderboard",
  LEADERBOARD_PLAYERS_FAILED: "Failed to fetch leaderboard players",
  LEADERBOARD_STATS_FAILED: "Failed to fetch leaderboard stats",

  // Events
  EVENT_ID_REQUIRED: "Event ID required",
  EVENT_NAME_TITLE_REQUIRED: "Name and title are required",
  EVENT_MULTIPLIER_INVALID: "PP multiplier must be between 1 and 5",
  EVENT_END_DATE_INVALID: "Invalid end date",
  EVENT_END_DATE_PAST: "End date must be in the future",
  EVENT_END_DATE_TOO_FAR: "End date cannot be more than 1 year in the future",
  EVENT_ALREADY_ACTIVE: "An active event already exists. Deactivate it first.",
  EVENT_CREATE_FAILED: "Failed to create event",
  EVENT_DELETE_FAILED: "Failed to delete event",
  EVENT_FETCH_FAILED: "Failed to fetch event leaderboard",

  // Validation
  VALIDATION_INVALID_THEME: "Invalid theme format",
  VALIDATION_INVALID_CHOICE: "Invalid choiceId format",
  VALIDATION_INVALID_SCENE: "Invalid sceneIndex: must be between 0 and 9",
  VALIDATION_INVALID_UPDATE: "Invalid update format",
  VALIDATION_INVALID_CONTENT_TYPE: "Invalid content type",

  // Generic
  INTERNAL_SERVER_ERROR: "Internal server error",
  UNKNOWN_ERROR: "Unknown error",
  OPERATION_FAILED: "Operation failed",
} as const

export type ErrorMessageKey = keyof typeof ERROR_MESSAGES
