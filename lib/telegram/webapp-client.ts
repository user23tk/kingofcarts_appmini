"use client"

// Client-side Telegram WebApp utilities
// This file should only be imported in client components

import { useEffect, useState } from "react"

export interface WebAppUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
  photo_url?: string
}

export interface WebAppThemeParams {
  bg_color?: string
  text_color?: string
  hint_color?: string
  link_color?: string
  button_color?: string
  button_text_color?: string
  secondary_bg_color?: string
}

/**
 * Hook to initialize and access Telegram WebApp
 */
export function useTelegramWebApp() {
  const [webApp, setWebApp] = useState<any>(null)
  const [user, setUser] = useState<WebAppUser | null>(null)
  const [initData, setInitData] = useState<string>("")
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Check if running in Telegram
    if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp

      // Initialize WebApp
      tg.ready()
      tg.expand()

      setWebApp(tg)
      setUser(tg.initDataUnsafe?.user || null)
      setInitData(tg.initData || "")
      setIsReady(true)

      console.log("[v0] Telegram WebApp initialized", {
        user: tg.initDataUnsafe?.user,
        platform: tg.platform,
        version: tg.version,
      })
    } else {
      console.warn("[v0] Not running in Telegram WebApp environment")
      setIsReady(true)
    }
  }, [])

  return {
    webApp,
    user,
    initData,
    isReady,
    isInTelegram: !!webApp,
  }
}

/**
 * Hook to manage Telegram WebApp theme
 */
export function useTelegramTheme() {
  const [theme, setTheme] = useState<WebAppThemeParams>({})
  const [colorScheme, setColorScheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp

      setTheme(tg.themeParams || {})
      setColorScheme(tg.colorScheme || "light")

      // Listen for theme changes
      tg.onEvent("themeChanged", () => {
        setTheme(tg.themeParams || {})
        setColorScheme(tg.colorScheme || "light")
      })
    }
  }, [])

  return { theme, colorScheme }
}

/**
 * Hook to manage Telegram WebApp main button
 */
export function useMainButton() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp
      setIsVisible(tg.MainButton?.isVisible || false)
    }
  }, [])

  const showMainButton = (text: string, onClick: () => void) => {
    if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp
      const btn = tg.MainButton

      btn.setText(text)
      btn.show()
      btn.onClick(onClick)
      setIsVisible(true)
    }
  }

  const hideMainButton = () => {
    if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp
      tg.MainButton.hide()
      setIsVisible(false)
    }
  }

  const setMainButtonLoading = (loading: boolean) => {
    if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp
      if (loading) {
        tg.MainButton.showProgress()
      } else {
        tg.MainButton.hideProgress()
      }
    }
  }

  return {
    isVisible,
    showMainButton,
    hideMainButton,
    setLoading: setMainButtonLoading,
  }
}

/**
 * Hook to manage Telegram WebApp back button
 */
export function useBackButton(onBack?: () => void) {
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp
      const btn = tg.BackButton

      if (onBack) {
        btn.show()
        btn.onClick(onBack)

        return () => {
          btn.hide()
          btn.offClick(onBack)
        }
      }
    }
  }, [onBack])
}

/**
 * Utility to trigger haptic feedback
 */
export function hapticFeedback(type: "light" | "medium" | "heavy" | "error" | "success" | "warning" = "light") {
  if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
    const tg = (window as any).Telegram.WebApp

    switch (type) {
      case "light":
      case "medium":
      case "heavy":
        tg.HapticFeedback?.impactOccurred(type)
        break
      case "error":
      case "success":
      case "warning":
        tg.HapticFeedback?.notificationOccurred(type)
        break
    }
  }
}

/**
 * Hook to use haptic feedback in components
 */
export function useHapticFeedback() {
  return {
    impactOccurred: (style: "light" | "medium" | "heavy" = "light") => {
      if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
        const tg = (window as any).Telegram.WebApp
        tg.HapticFeedback?.impactOccurred(style)
      }
    },
    notificationOccurred: (type: "error" | "success" | "warning") => {
      if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
        const tg = (window as any).Telegram.WebApp
        tg.HapticFeedback?.notificationOccurred(type)
      }
    },
    selectionChanged: () => {
      if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
        const tg = (window as any).Telegram.WebApp
        tg.HapticFeedback?.selectionChanged()
      }
    },
  }
}

/**
 * Utility to close the Mini App
 */
export function closeMiniApp() {
  if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
    const tg = (window as any).Telegram.WebApp
    tg.close()
  }
}
