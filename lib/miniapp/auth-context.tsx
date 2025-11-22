"use client"

import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from "react"
import { useTelegramWebApp } from "@/lib/telegram/webapp-client"

interface User {
  id: string
  telegramId: number
  username?: string
  firstName: string
  lastName?: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  initData: string | null
  login: () => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { initData, user: tgUser, isReady, isInTelegram } = useTelegramWebApp()
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const login = async () => {
    if (!initData) {
      return
    }

    try {
      setIsLoading(true)

      const response = await fetch("/api/miniapp/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ initData }),
      })

      if (!response.ok) {
        throw new Error("Authentication failed")
      }

      const data = await response.json()

      setUser(data.user)
      setToken(data.token)

      // Store token in localStorage
      localStorage.setItem("miniapp_token", data.token)
      localStorage.setItem("miniapp_user", JSON.stringify(data.user))
    } catch (error) {
      console.error("Login error:", error)
      setUser(null)
      setToken(null)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem("miniapp_token")
    localStorage.removeItem("miniapp_user")
  }

  // Auto-login when WebApp is ready
  useEffect(() => {
    if (!isReady) return

    // Check for stored token first
    const storedToken = localStorage.getItem("miniapp_token")
    const storedUser = localStorage.getItem("miniapp_user")

    if (storedToken && storedUser) {
      try {
        setToken(storedToken)
        setUser(JSON.parse(storedUser))
        setIsLoading(false)
        return
      } catch (error) {
        console.error("Failed to restore session:", error)
        localStorage.removeItem("miniapp_token")
        localStorage.removeItem("miniapp_user")
      }
    }

    // If in Telegram and have initData, auto-login
    if (isInTelegram && initData) {
      login()
    } else {
      setIsLoading(false)
    }
  }, [isReady, isInTelegram, initData])

  const contextValue = useMemo(
    () => ({
      user,
      token,
      isLoading,
      isAuthenticated: !!user && !!token,
      initData,
      login,
      logout,
    }),
    [user, token, isLoading, initData],
  )

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
