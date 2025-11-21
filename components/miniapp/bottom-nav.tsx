"use client"

import { usePathname, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { useHapticFeedback } from "@/lib/telegram/webapp-client"

interface NavItem {
  path: string
  icon: string
  label: string
  activeIcon?: string
}

const NAV_ITEMS: NavItem[] = [
  { path: "/", icon: "🏠", label: "Home", activeIcon: "🏠" },
  { path: "/themes", icon: "📖", label: "Storia", activeIcon: "📖" },
  { path: "/leaderboard", icon: "🏆", label: "Classifica", activeIcon: "🏆" },
  { path: "/profile", icon: "👤", label: "Profilo", activeIcon: "👤" },
]

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const haptic = useHapticFeedback()

  const handleNavigation = (path: string) => {
    if (pathname === path) return
    haptic.impactOccurred("light")
    router.push(path)
  }

  // Don't show on story pages
  if (pathname.startsWith("/story/")) {
    return null
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 backdrop-blur-lg bg-tg-surface/95 border-t border-white/10 shadow-lg"
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
      }}
    >
      <div className="max-w-2xl mx-auto px-2">
        <div className="flex items-center justify-around h-14">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.path

            return (
              <button
                key={item.path}
                onClick={() => handleNavigation(item.path)}
                className="relative flex flex-col items-center justify-center gap-0.5 min-w-[60px] py-1.5 transition-transform active:scale-95"
              >
                {/* Icon */}
                <div className="relative">
                  <motion.div
                    className="text-xl"
                    animate={{
                      scale: isActive ? 1.1 : 1,
                    }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    {isActive ? item.activeIcon || item.icon : item.icon}
                  </motion.div>

                  {/* Active indicator dot */}
                  {isActive && (
                    <motion.div
                      className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-tg-primary rounded-full"
                      layoutId="activeIndicator"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                  )}
                </div>

                {/* Label */}
                <span
                  className={`
                    text-[10px] font-medium transition-colors
                    ${isActive ? "text-tg-primary" : "text-white/60"}
                  `}
                >
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
