"use client"

import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Clock, Trophy } from "lucide-react"
import { motion } from "framer-motion"

interface GiveawayHeaderProps {
  name: string
  endsAt: string
  isActive: boolean
  hasEnded: boolean
  hasWinner: boolean
  themeEmoji?: string | null
}

export function GiveawayHeader({ name, endsAt, isActive, hasEnded, hasWinner, themeEmoji }: GiveawayHeaderProps) {
  const [timeRemaining, setTimeRemaining] = useState("")
  const [isUrgent, setIsUrgent] = useState(false)

  useEffect(() => {
    const updateCountdown = () => {
      const end = new Date(endsAt).getTime()
      const now = Date.now()
      const diff = end - now

      if (diff <= 0) {
        setTimeRemaining("Terminato")
        setIsUrgent(false)
        return
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

      // Set urgent if less than 24 hours
      setIsUrgent(diff < 24 * 60 * 60 * 1000)

      if (days > 0) {
        setTimeRemaining(`${days}g ${hours}h ${minutes}m`)
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`)
      } else {
        setTimeRemaining(`${minutes}m`)
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [endsAt])

  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-900/80 via-purple-800/60 to-pink-900/80 p-4 backdrop-blur-md border border-purple-500/30">
      {/* Animated background glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-cyan-500/10 animate-pulse" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {themeEmoji && <span className="text-2xl">{themeEmoji}</span>}
            <h1 className="text-xl font-bold text-white">{name}</h1>
          </div>

          {/* Status badge */}
          {hasWinner ? (
            <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/50">
              <Trophy className="w-3 h-3 mr-1" />
              Completato
            </Badge>
          ) : hasEnded ? (
            <Badge variant="secondary" className="bg-gray-500/20 text-gray-300">
              Terminato
            </Badge>
          ) : isActive ? (
            <Badge className="bg-green-500/20 text-green-300 border-green-500/50 animate-pulse">Attivo</Badge>
          ) : (
            <Badge variant="secondary">Non Attivo</Badge>
          )}
        </div>

        {/* Countdown */}
        {!hasEnded && !hasWinner && (
          <motion.div
            className={`flex items-center gap-2 ${isUrgent ? "text-orange-300" : "text-white/80"}`}
            animate={isUrgent ? { scale: [1, 1.02, 1] } : {}}
            transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2 }}
          >
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium">
              Termina tra: <span className="font-bold">{timeRemaining}</span>
            </span>
          </motion.div>
        )}
      </div>
    </div>
  )
}
