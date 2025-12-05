"use client"

// Client-side Telegram WebApp utilities
// This file should only be imported in client components

import { useEffect, useState, useCallback } from "react"

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

export interface SafeAreaInset {
  top: number
  bottom: number
  left: number
  right: number
}

export interface ViewportState {
  isFullscreen: boolean
  safeAreaInset: SafeAreaInset
  contentSafeAreaInset: SafeAreaInset
  viewportHeight: number
  viewportStableHeight: number
  isExpanded: boolean
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
 * Hook to manage fullscreen mode and safe area insets
 * Requires Telegram Bot API 8.0+
 */
export function useFullscreen() {
  const [viewportState, setViewportState] = useState<ViewportState>({
    isFullscreen: false,
    safeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
    contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
    viewportHeight: 0,
    viewportStableHeight: 0,
    isExpanded: false,
  })

  const updateViewportState = useCallback(() => {
    if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp

      setViewportState({
        isFullscreen: tg.isFullscreen || false,
        safeAreaInset: tg.safeAreaInset || { top: 0, bottom: 0, left: 0, right: 0 },
        contentSafeAreaInset: tg.contentSafeAreaInset || { top: 0, bottom: 0, left: 0, right: 0 },
        viewportHeight: tg.viewportHeight || window.innerHeight,
        viewportStableHeight: tg.viewportStableHeight || window.innerHeight,
        isExpanded: tg.isExpanded || false,
      })
    }
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp

      // Initial state
      updateViewportState()

      // Listen for viewport changes
      tg.onEvent("viewportChanged", updateViewportState)
      tg.onEvent("fullscreenChanged", updateViewportState)
      tg.onEvent("safeAreaChanged", updateViewportState)
      tg.onEvent("contentSafeAreaChanged", updateViewportState)

      return () => {
        tg.offEvent("viewportChanged", updateViewportState)
        tg.offEvent("fullscreenChanged", updateViewportState)
        tg.offEvent("safeAreaChanged", updateViewportState)
        tg.offEvent("contentSafeAreaChanged", updateViewportState)
      }
    }
  }, [updateViewportState])

  const requestFullscreen = useCallback(() => {
    if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp
      // Check if method exists (Bot API 8.0+)
      if (typeof tg.requestFullscreen === "function") {
        tg.requestFullscreen()
        console.log("[v0] Requested fullscreen mode")
      } else {
        // Fallback to expand for older versions
        tg.expand()
        console.log("[v0] Fullscreen not available, using expand fallback")
      }
    }
  }, [])

  const exitFullscreen = useCallback(() => {
    if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp
      if (typeof tg.exitFullscreen === "function") {
        tg.exitFullscreen()
        console.log("[v0] Exited fullscreen mode")
      }
    }
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (viewportState.isFullscreen) {
      exitFullscreen()
    } else {
      requestFullscreen()
    }
  }, [viewportState.isFullscreen, requestFullscreen, exitFullscreen])

  return {
    ...viewportState,
    requestFullscreen,
    exitFullscreen,
    toggleFullscreen,
  }
}

/**
 * Hook to apply safe area insets as CSS variables
 * Use with CSS: padding-top: var(--safe-area-top, 0px);
 */
export function useSafeAreaCSS() {
  const { safeAreaInset, contentSafeAreaInset, isFullscreen } = useFullscreen()

  useEffect(() => {
    const root = document.documentElement

    // Device safe area (notch, dynamic island, etc.)
    root.style.setProperty("--safe-area-top", `${safeAreaInset.top}px`)
    root.style.setProperty("--safe-area-bottom", `${safeAreaInset.bottom}px`)
    root.style.setProperty("--safe-area-left", `${safeAreaInset.left}px`)
    root.style.setProperty("--safe-area-right", `${safeAreaInset.right}px`)

    // Content safe area (Telegram header/footer when not fullscreen)
    root.style.setProperty("--content-safe-area-top", `${contentSafeAreaInset.top}px`)
    root.style.setProperty("--content-safe-area-bottom", `${contentSafeAreaInset.bottom}px`)
    root.style.setProperty("--content-safe-area-left", `${contentSafeAreaInset.left}px`)
    root.style.setProperty("--content-safe-area-right", `${contentSafeAreaInset.right}px`)

    // Combined safe area (max of both for total safe padding needed)
    root.style.setProperty("--total-safe-top", `${Math.max(safeAreaInset.top, contentSafeAreaInset.top)}px`)
    root.style.setProperty("--total-safe-bottom", `${Math.max(safeAreaInset.bottom, contentSafeAreaInset.bottom)}px`)

    // Fullscreen state
    root.style.setProperty("--is-fullscreen", isFullscreen ? "1" : "0")

    console.log("[v0] Safe area CSS updated", { safeAreaInset, contentSafeAreaInset, isFullscreen })
  }, [safeAreaInset, contentSafeAreaInset, isFullscreen])
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
