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
        setTimeRemaining("Ready to play!")
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`)
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
        <div className="rounded-lg border border-red-500/20 bg-red-950/90 p-4 backdrop-blur-lg">
          <div className="flex items-start gap-3">
            <div className="text-2xl">⏱️</div>
            <div className="flex-1">
              <h3 className="font-semibold text-red-200">Daily Limit Reached</h3>
              <p className="mt-1 text-sm text-red-300">
                You've reached your daily story limit. Come back tomorrow to continue your adventure!
              </p>
              {timeRemaining && <p className="mt-2 text-sm font-mono text-red-400">Resets in: {timeRemaining}</p>}
            </div>
            {onDismiss && (
              <button onClick={onDismiss} className="text-red-400 hover:text-red-300">
                ✕
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
