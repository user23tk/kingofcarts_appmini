// Anti-replay system to prevent button spam and duplicate actions
export class AntiReplayManager {
  private static processedCallbacks = new Map<string, number>()
  private static readonly CALLBACK_EXPIRY =
    Number.parseInt(process.env.CALLBACK_TOKEN_EXPIRY_MINUTES || "5") * 60 * 1000

  static isCallbackProcessed(callbackQueryId: string): boolean {
    const now = Date.now()

    // Clean expired entries
    for (const [id, timestamp] of this.processedCallbacks.entries()) {
      if (now - timestamp > this.CALLBACK_EXPIRY) {
        this.processedCallbacks.delete(id)
      }
    }

    return this.processedCallbacks.has(callbackQueryId)
  }

  static markCallbackProcessed(callbackQueryId: string): void {
    this.processedCallbacks.set(callbackQueryId, Date.now())
  }

  static generateUniqueCallbackData(baseData: string, userId: string): string {
    const timestamp = Date.now()
    const hash = this.simpleHash(`${baseData}_${userId}_${timestamp}`)
    return `${baseData}_${hash.toString(36)}`
  }

  private static simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }
}
