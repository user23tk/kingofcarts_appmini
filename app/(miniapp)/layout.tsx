"use client"

import type React from "react"

import { useEffect } from "react"
import { AuthProvider } from "@/lib/miniapp/auth-context"
import { useTelegramTheme } from "@/lib/telegram/webapp-client"
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
    // Expand to fullscreen and lock viewport
    if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
      const tg = (window as any).Telegram.WebApp
      tg.expand()
      tg.disableVerticalSwipes()
    }
  }, [])

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <AuthProvider>
        <div className="fixed inset-0 bg-background overflow-hidden">
          <div className="h-full mx-auto max-w-2xl flex flex-col">
            <div className="flex-1 overflow-y-auto pb-20">{children}</div>
            <BottomNav currentPath={pathname} />
          </div>
        </div>
      </AuthProvider>
    </>
  )
}
