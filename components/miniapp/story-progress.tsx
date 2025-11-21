"use client"

import { motion } from "framer-motion"
import { THEME_COLORS } from "@/lib/theme-colors"

interface StoryProgressProps {
  currentScene: number // 0-9
  totalScenes: number // 10
  currentPP: number
  sessionPP: number
  theme: string
  chapterNumber: number
  variant?: "top" | "bottom" | "inline"
}

export function StoryProgress({
  currentScene,
  totalScenes,
  currentPP,
  sessionPP,
  theme,
  chapterNumber,
  variant = "top",
}: StoryProgressProps) {
  const themeColor = THEME_COLORS[theme as keyof typeof THEME_COLORS]?.primary || "#2AABEE"
  const isSticky = variant === "top" || variant === "bottom"

  return (
    <div
      className={`
        w-full z-20
        ${isSticky ? "sticky backdrop-blur-lg bg-tg-bg/80" : ""}
        ${variant === "top" ? "top-0" : variant === "bottom" ? "bottom-0" : ""}
      `}
      style={{
        paddingTop: variant === "top" ? "env(safe-area-inset-top)" : undefined,
        paddingBottom: variant === "bottom" ? "env(safe-area-inset-bottom)" : undefined,
      }}
    >
      <div className="max-w-2xl mx-auto px-4 py-3">
        {/* Progress Dots */}
        <div className="flex items-center justify-center gap-2 mb-3">
          {Array.from({ length: totalScenes }).map((_, index) => {
            const isCompleted = index < currentScene
            const isCurrent = index === currentScene

            return (
              <motion.div
                key={index}
                className="relative"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                {/* Dot */}
                <div
                  className={`
                    w-3 h-3 rounded-full transition-all duration-300
                    ${isCompleted || isCurrent ? "scale-100" : "scale-75 opacity-40"}
                  `}
                  style={{
                    backgroundColor: isCompleted || isCurrent ? themeColor : "#4A5568",
                  }}
                />

                {/* Glow effect for current */}
                {isCurrent && (
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{ backgroundColor: themeColor }}
                    animate={{
                      scale: [1, 1.8, 1],
                      opacity: [0.6, 0, 0.6],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "easeInOut",
                    }}
                  />
                )}

                {/* Checkmark for completed */}
                {isCompleted && (
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </motion.div>
                )}
              </motion.div>
            )
          })}
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-between text-sm">
          {/* PP Stats */}
          <div className="flex items-center gap-2">
            <span className="text-pp-gold">⭐</span>
            <motion.span
              key={currentPP}
              className="font-bold text-white"
              initial={{ scale: 1.2, color: "#FFD700" }}
              animate={{ scale: 1, color: "#FFFFFF" }}
              transition={{ duration: 0.3 }}
            >
              {currentPP.toLocaleString()}
            </motion.span>
            <span className="text-white/60">PP</span>

            {sessionPP > 0 && (
              <motion.span
                className="text-green-400 text-xs font-medium"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
              >
                (+{sessionPP})
              </motion.span>
            )}
          </div>

          {/* Scene Counter */}
          <div className="text-white/60">
            Scena <span className="text-white font-medium">{currentScene + 1}</span>/{totalScenes}
          </div>

          {/* Theme & Chapter */}
          <div className="flex items-center gap-2">
            <span style={{ color: themeColor }}>{getThemeEmoji(theme)}</span>
            <span className="text-white/60">
              Cap. <span className="text-white font-medium">{chapterNumber}</span>
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: themeColor }}
            initial={{ width: 0 }}
            animate={{ width: `${((currentScene + 1) / totalScenes) * 100}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>
    </div>
  )
}

function getThemeEmoji(theme: string): string {
  const emojis: Record<string, string> = {
    fantasy: "🎭",
    "sci-fi": "🚀",
    mystery: "🔍",
    horror: "👻",
    romance: "💕",
    adventure: "🗺️",
    comedy: "😂",
  }
  return emojis[theme] || "📖"
}
