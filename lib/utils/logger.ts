/**
 * Livelli di log
 */
export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

/**
 * Configurazione logger
 */
interface LoggerConfig {
  level: LogLevel
  enableConsole: boolean
  prefix: string
}

/**
 * Logger centralizzato con livelli e formattazione
 */
class Logger {
  private config: LoggerConfig

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
      enableConsole: process.env.NODE_ENV !== "production",
      prefix: "[v0]",
      ...config,
    }
  }

  /**
   * Verifica se il livello di log è abilitato
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR]
    const currentLevelIndex = levels.indexOf(this.config.level)
    const requestedLevelIndex = levels.indexOf(level)
    return requestedLevelIndex >= currentLevelIndex
  }

  /**
   * Formatta il messaggio di log
   */
  private format(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString()
    const prefix = this.config.prefix
    let formatted = `${prefix} [${level.toUpperCase()}] [${timestamp}] ${message}`

    if (data !== undefined) {
      formatted += ` ${JSON.stringify(data, null, 2)}`
    }

    return formatted
  }

  /**
   * Log debug (solo in development)
   */
  debug(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.DEBUG) && this.config.enableConsole) {
      console.debug(this.format(LogLevel.DEBUG, message, data))
    }
  }

  /**
   * Log info
   */
  info(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.INFO) && this.config.enableConsole) {
      console.log(this.format(LogLevel.INFO, message, data))
    }
  }

  /**
   * Log warning
   */
  warn(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.WARN) && this.config.enableConsole) {
      console.warn(this.format(LogLevel.WARN, message, data))
    }
  }

  /**
   * Log error
   */
  error(message: string, error?: any): void {
    if (this.shouldLog(LogLevel.ERROR) && this.config.enableConsole) {
      const errorData = error instanceof Error ? { message: error.message, stack: error.stack } : error
      console.error(this.format(LogLevel.ERROR, message, errorData))
    }
  }

  /**
   * Crea un logger con un prefisso specifico
   */
  child(prefix: string): Logger {
    return new Logger({
      ...this.config,
      prefix: `${this.config.prefix} ${prefix}`,
    })
  }
}

// Istanza singleton
export const logger = new Logger()

// Logger specifici per moduli
export const apiLogger = logger.child("[API]")
export const dbLogger = logger.child("[DB]")
export const securityLogger = logger.child("[SECURITY]")
export const telegramLogger = logger.child("[TELEGRAM]")
export const leaderboardLogger = logger.child("[LEADERBOARD]")
