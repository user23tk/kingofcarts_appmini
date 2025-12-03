"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface RateLimitNoticeProps {
  resetTime?: string
  onDismiss?: () => void
}

export function RateLimitNotice({ resetTime, onDismiss }: RateLimitNoticeProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("")

  useEffect(() => {
    if (!resetTime) return

    const updateTimeRemaining = () => {
      const now = new Date()
      const reset = new Date(resetTime)
      const diff = reset.getTime() - now.getTime()

      if (diff <= 0) {
        setTimeRemaining("Pronto per giocare!")
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`)
      } else if (minutes > 0) {
        setTimeRemaining(`${minutes}m ${seconds}s`)
      } else {
        setTimeRemaining(`${seconds}s`)
      }
    }

    updateTimeRemaining()
    const interval = setInterval(updateTimeRemaining, 1000)

    return () => clearInterval(interval)
  }, [resetTime])

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-4 left-4 right-4 z-50 mx-auto max-w-md"
      >
        <div className="rounded-lg border border-amber-500/20 bg-amber-950/90 p-4 backdrop-blur-lg">
          <div className="flex items-start gap-3">
            <div className="text-2xl">⏱️</div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-200">Limite Raggiunto</h3>
              <p className="mt-1 text-sm text-amber-300">
                Hai giocato troppo! Prenditi una pausa e torna più tardi.
              </p>
              {timeRemaining && <p className="mt-2 text-sm font-mono text-amber-400">Reset tra: {timeRemaining}</p>}
            </div>
            {onDismiss && (
              <button onClick={onDismiss} className="text-amber-400 hover:text-amber-300">
                ✕
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
