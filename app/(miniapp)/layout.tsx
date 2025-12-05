"use client"

import type React from "react"

import { useEffect } from "react"
import { AuthProvider } from "@/lib/miniapp/auth-context"
import { useTelegramTheme, useFullscreen, useSafeAreaCSS } from "@/lib/telegram/webapp-client"
import { BottomNav } from "@/components/miniapp/bottom-nav"
import { usePathname } from "next/navigation"
import Script from "next/script"

export default function MiniAppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { theme, colorScheme } = useTelegramTheme()
  const pathname = usePathname()

  const { requestFullscreen, isFullscreen, viewportHeight } = useFullscreen()
  useSafeAreaCSS() // Apply safe area CSS variables

  useEffect(() => {
    // Apply Telegram theme colors to CSS variables
    if (theme.bg_color) {
      document.documentElement.style.setProperty("--tg-bg-color", theme.bg_color)
    }
    if (theme.text_color) {
      document.documentElement.style.setProperty("--tg-text-color", theme.text_color)
    }
    if (theme.button_color) {
      document.documentElement.style.setProperty("--tg-button-color", theme.button_color)
    }
    if (theme.button_text_color) {
      document.documentElement.style.setProperty("--tg-button-text-color", theme.button_text_color)
    }

    // Apply color scheme class
    if (colorScheme === "dark") {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [theme, colorScheme])

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp

      // First expand to fill available space
      tg.expand()
      tg.disableVerticalSwipes()

      // Then request true fullscreen if available (Bot API 8.0+)
      // Small delay to ensure expand completes first
      const timer = setTimeout(() => {
        if (typeof tg.requestFullscreen === "function") {
          tg.requestFullscreen()
          console.log("[v0] Requested true fullscreen mode")
        }
      }, 100)

      return () => clearTimeout(timer)
    }
  }, [])

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <AuthProvider>
        <div
          className="fixed inset-0 bg-background overflow-hidden"
          style={{
            // Use CSS variables for safe area, with fallbacks
            // Add extra top padding (56px = pt-14) for Telegram header
            paddingTop: "calc(var(--total-safe-top, 0px) + 56px)",
            paddingBottom: "var(--safe-area-bottom, 0px)",
            paddingLeft: "calc(var(--safe-area-left, 0px) + 12px)",
            paddingRight: "calc(var(--safe-area-right, 0px) + 12px)",
          }}
        >
          <div className="h-full mx-auto max-w-2xl flex flex-col">
            <div className="flex-1 overflow-y-auto pb-20">{children}</div>
            <BottomNav currentPath={pathname} />
          </div>
        </div>
      </AuthProvider>
    </>
  )
}
