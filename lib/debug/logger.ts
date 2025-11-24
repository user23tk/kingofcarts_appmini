/**
 * Centralized logging system with structured logging and automatic sanitization
 * Prevents sensitive data leaks and provides consistent logging across the app
 */

type LogLevel = "debug" | "info" | "warn" | "error"

interface LogEntry {
  timestamp: string
  level: LogLevel
  context: string
  message: string
  extra?: any
}

/**
 * Fields that should never be logged
 */
const SENSITIVE_FIELDS = [
  "password",
  "token",
  "secret",
  "initData",
  "authorization",
  "admin_key",
  "adminKey",
  "api_key",
  "apiKey",
  "bot_token",
  "botToken",
  "webhook_secret",
  "webhookSecret",
  "jwt",
  "session",
  "cookie",
]

/**
 * Fields that should be partially masked
 */
const MASKABLE_FIELDS = ["email", "phone", "telegram_id", "telegramId", "ip", "ip_address"]

class Logger {
  private isProduction = process.env.NODE_ENV === "production"
  private logLevel = process.env.LOG_LEVEL || (this.isProduction ? "info" : "debug")

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ["debug", "info", "warn", "error"]
    const currentLevelIndex = levels.indexOf(this.logLevel as LogLevel)
    const messageLevelIndex = levels.indexOf(level)
    return messageLevelIndex >= currentLevelIndex
  }

  private sanitize(data: any): any {
    if (data === null || data === undefined) return data
    if (typeof data !== "object") return data

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitize(item))
    }

    const sanitized: any = {}

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase()

      // Remove sensitive fields entirely
      if (SENSITIVE_FIELDS.some((field) => lowerKey.includes(field.toLowerCase()))) {
        sanitized[key] = "[REDACTED]"
        continue
      }

      // Partially mask certain fields
      if (MASKABLE_FIELDS.some((field) => lowerKey.includes(field.toLowerCase()))) {
        if (typeof value === "string") {
          sanitized[key] = this.maskValue(value)
        } else if (typeof value === "number") {
          sanitized[key] = `***${String(value).slice(-4)}`
        } else {
          sanitized[key] = "[MASKED]"
        }
        continue
      }

      // Recursively sanitize nested objects
      if (typeof value === "object" && value !== null) {
        sanitized[key] = this.sanitize(value)
      } else {
        sanitized[key] = value
      }
    }

    return sanitized
  }

  private maskValue(value: string): string {
    if (value.length <= 4) return "***"
    return `***${value.slice(-4)}`
  }

  private formatLog(entry: LogEntry): string {
    const emoji = {
      debug: "🔍",
      info: "ℹ️",
      warn: "⚠️",
      error: "❌",
    }

    let log = `${emoji[entry.level]} [${entry.level.toUpperCase()}] [${entry.context}] ${entry.message}`

    if (entry.extra) {
      const sanitized = this.sanitize(entry.extra)
      log += `\n${JSON.stringify(sanitized, null, 2)}`
    }

    return log
  }

  private log(level: LogLevel, context: string, message: string, extra?: any): void {
    if (!this.shouldLog(level)) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      extra: extra ? this.sanitize(extra) : undefined,
    }

    const formattedLog = this.formatLog(entry)

    switch (level) {
      case "debug":
        console.log(formattedLog)
        break
      case "info":
        console.log(formattedLog)
        break
      case "warn":
        console.warn(formattedLog)
        break
      case "error":
        console.error(formattedLog)
        break
    }
  }

  debug(context: string, message: string, extra?: any): void {
    this.log("debug", context, message, extra)
  }

  info(context: string, message: string, extra?: any): void {
    this.log("info", context, message, extra)
  }

  warn(context: string, message: string, extra?: any): void {
    this.log("warn", context, message, extra)
  }

  error(context: string, message: string, extra?: any): void {
    this.log("error", context, message, extra)
  }
}

export const logger = new Logger()
