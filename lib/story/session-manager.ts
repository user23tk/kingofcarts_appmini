import { createClient } from "@/lib/supabase/server"

export interface UserSession {
  userId: string
  currentScene: number
  currentChoices: any[]
  ppAccumulated: number
  sessionStarted: Date
  lastActivity: Date
}

// In-memory session storage (in production, use Redis or database)
const activeSessions = new Map<string, UserSession>()

export class SessionManager {
  private static readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

  createSession(userId: string): UserSession {
    this.cleanupExpiredSessions()

    const now = new Date()
    const session: UserSession = {
      userId,
      currentScene: 0,
      currentChoices: [],
      ppAccumulated: 0,
      sessionStarted: now,
      lastActivity: now,
    }

    activeSessions.set(userId, session)
    return session
  }

  getSession(userId: string): UserSession | null {
    const session = activeSessions.get(userId)
    if (!session) return null

    if (this.isSessionExpired(session)) {
      this.clearSession(userId)
      return null
    }

    session.lastActivity = new Date()
    activeSessions.set(userId, session)
    return session
  }

  updateSession(userId: string, updates: Partial<UserSession>): UserSession | null {
    const session = activeSessions.get(userId)
    if (!session) return null

    if (this.isSessionExpired(session)) {
      this.clearSession(userId)
      return null
    }

    const updatedSession = {
      ...session,
      ...updates,
      lastActivity: new Date(),
    }
    activeSessions.set(userId, updatedSession)
    return updatedSession
  }

  clearSession(userId: string): void {
    activeSessions.delete(userId)
  }

  private isSessionExpired(session: UserSession): boolean {
    const now = new Date()
    const timeSinceLastActivity = now.getTime() - session.lastActivity.getTime()
    return timeSinceLastActivity > SessionManager.SESSION_TIMEOUT_MS
  }

  private cleanupExpiredSessions(): void {
    const expiredSessions: string[] = []

    for (const [userId, session] of activeSessions.entries()) {
      if (this.isSessionExpired(session)) {
        expiredSessions.push(userId)
      }
    }

    // Remove expired sessions
    expiredSessions.forEach((userId) => {
      activeSessions.delete(userId)
    })

    if (expiredSessions.length > 0) {
      console.log(`[SessionManager] Cleaned up ${expiredSessions.length} expired sessions`)
    }
  }

  getSessionStats(): { activeCount: number; oldestSession: Date | null } {
    let oldestSession: Date | null = null

    for (const session of activeSessions.values()) {
      if (!oldestSession || session.sessionStarted < oldestSession) {
        oldestSession = session.sessionStarted
      }
    }

    return {
      activeCount: activeSessions.size,
      oldestSession,
    }
  }

  async incrementInteractionCount(): Promise<void> {
    const supabase = await createClient()

    await supabase.rpc("increment_global_stat", {
      stat_name_param: "total_interactions",
    })
  }
}
