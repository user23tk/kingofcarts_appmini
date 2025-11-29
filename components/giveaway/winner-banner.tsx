"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, Ticket, Crown, PartyPopper } from "lucide-react"
import { motion } from "framer-motion"
import type { GiveawayWinner } from "@/lib/giveaway/types"

interface WinnerBannerProps {
  winner: GiveawayWinner
}

export function WinnerBanner({ winner }: WinnerBannerProps) {
  const isCurrentUser = winner.is_current_user

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
    >
      <Card
        className={`relative overflow-hidden ${
          isCurrentUser
            ? "bg-gradient-to-br from-yellow-500/30 via-orange-500/20 to-red-500/30 border-yellow-500/50"
            : "bg-gradient-to-br from-purple-900/50 to-pink-900/50 border-purple-500/30"
        } backdrop-blur-md`}
      >
        {/* Animated background for winner */}
        {isCurrentUser && (
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 via-transparent to-yellow-500/20 animate-pulse" />
          </div>
        )}

        <CardContent className="relative z-10 p-6 text-center">
          {/* Icon */}
          <motion.div
            className="mx-auto mb-4"
            animate={isCurrentUser ? { rotate: [0, -10, 10, 0], scale: [1, 1.1, 1] } : {}}
            transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2 }}
          >
            {isCurrentUser ? (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg shadow-yellow-500/50">
                <Crown className="w-8 h-8 text-white" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Trophy className="w-8 h-8 text-white" />
              </div>
            )}
          </motion.div>

          {/* Title */}
          <h2 className={`text-xl font-bold mb-2 ${isCurrentUser ? "text-yellow-300" : "text-white"}`}>
            {isCurrentUser ? (
              <>
                <PartyPopper className="inline w-5 h-5 mr-2" />
                HAI VINTO!
                <PartyPopper className="inline w-5 h-5 ml-2" />
              </>
            ) : (
              "Vincitore Estratto!"
            )}
          </h2>

          {/* Winner info */}
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2">
              <Ticket className="w-5 h-5 text-cyan-400" />
              <span className="font-mono text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                #{winner.ticket_number}
              </span>
            </div>

            <div className="text-white/80">
              {winner.username ? (
                <Badge variant="secondary" className="bg-white/10 text-white">
                  @{winner.username}
                </Badge>
              ) : (
                <span>{winner.display_name}</span>
              )}
            </div>

            <div className="text-xs text-white/50">
              Estratto il{" "}
              {new Date(winner.drawn_at).toLocaleDateString("it-IT", {
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>

          {isCurrentUser && (
            <motion.p
              className="mt-4 text-sm text-yellow-200/80"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              Controlla i tuoi messaggi Telegram per ricevere il premio!
            </motion.p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
