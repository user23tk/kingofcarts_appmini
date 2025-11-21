"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useHapticFeedback } from "@/lib/telegram/webapp-client"

interface Choice {
  id: string
  text: string
  emoji: string
  ppDelta: number
}

interface StoryChoicesProps {
  choices: Choice[]
  onSelect: (choiceId: string) => Promise<void>
  disabled?: boolean
}

export function StoryChoices({ choices, onSelect, disabled = false }: StoryChoicesProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const haptic = useHapticFeedback()

  const handleSelect = async (choiceId: string) => {
    if (isProcessing || disabled) return

    setSelectedId(choiceId)
    setIsProcessing(true)
    haptic.impactOccurred("medium")

    try {
      await onSelect(choiceId)
    } catch (error) {
      console.error("[v0] Choice selection error:", error)
      setSelectedId(null)
      setIsProcessing(false)
      haptic.notificationOccurred("error")
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pb-24">
      <AnimatePresence mode="wait">
        <motion.div className="space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {choices.map((choice, index) => {
            const isSelected = selectedId === choice.id
            const isOtherSelected = selectedId && selectedId !== choice.id

            return (
              <motion.button
                key={choice.id}
                onClick={() => handleSelect(choice.id)}
                disabled={disabled || isProcessing}
                className={`
                  w-full relative overflow-hidden rounded-2xl
                  transition-all duration-300
                  ${isSelected ? "scale-[1.02]" : isOtherSelected ? "opacity-30 scale-95" : "hover:scale-[1.02]"}
                  ${disabled || isProcessing ? "cursor-not-allowed" : "cursor-pointer active:scale-[0.98]"}
                `}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                {/* Glassmorphism background */}
                <div className="absolute inset-0 bg-white/10 backdrop-blur-md border border-white/20" />

                {/* Glow effect on hover/select */}
                <div
                  className={`
                  absolute inset-0 bg-gradient-to-r from-tg-primary/20 to-transparent
                  opacity-0 transition-opacity duration-300
                  ${isSelected ? "opacity-100" : "group-hover:opacity-50"}
                `}
                />

                {/* Ripple effect */}
                {isSelected && (
                  <motion.div
                    className="absolute inset-0 bg-tg-primary/30 rounded-2xl"
                    initial={{ scale: 0, opacity: 1 }}
                    animate={{ scale: 2, opacity: 0 }}
                    transition={{ duration: 0.6 }}
                  />
                )}

                {/* Content */}
                <div className="relative flex items-center gap-4 p-4">
                  {/* Emoji */}
                  <div className="text-4xl flex-shrink-0">{choice.emoji}</div>

                  {/* Text */}
                  <div className="flex-1 text-left">
                    <p className="text-white font-medium text-base leading-relaxed">{choice.text}</p>
                  </div>

                  {/* Checkmark animation */}
                  {isSelected && (
                    <motion.div
                      className="absolute right-4 top-1/2 -translate-y-1/2"
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 200 }}
                    >
                      <div className="w-8 h-8 rounded-full bg-tg-primary flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Bottom shine effect */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              </motion.button>
            )
          })}
        </motion.div>
      </AnimatePresence>

      {/* Loading indicator */}
      {isProcessing && (
        <motion.div className="mt-6 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="inline-flex items-center gap-2 text-white/60">
            <div className="w-2 h-2 bg-tg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="w-2 h-2 bg-tg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="w-2 h-2 bg-tg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </motion.div>
      )}
    </div>
  )
}
