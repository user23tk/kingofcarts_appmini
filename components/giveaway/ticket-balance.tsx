"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Ticket, Sparkles, Loader2, TrendingUp } from "lucide-react"
import { motion } from "framer-motion"
import type { UserTicketData } from "@/lib/giveaway/types"

interface TicketBalanceProps {
  userData: UserTicketData
  onUseTicket: () => Promise<void>
  isLoading: boolean
  disabled?: boolean
}

export function TicketBalance({ userData, onUseTicket, isLoading, disabled = false }: TicketBalanceProps) {
  const { total_pp, pp_per_ticket, tickets_total, tickets_used, tickets_available, pp_for_next_ticket } = userData

  const progressPercent = tickets_total > 0 ? (tickets_used / tickets_total) * 100 : 0
  const ppProgress = ((pp_per_ticket - pp_for_next_ticket) / pp_per_ticket) * 100

  return (
    <Card className="bg-gradient-to-br from-purple-900/50 to-indigo-900/50 backdrop-blur-md border border-purple-500/30">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg text-white">
          <Ticket className="w-5 h-5 text-cyan-400" />I Tuoi Ticket
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* PP Display */}
        <div className="flex items-center justify-between">
          <span className="text-white/70 text-sm">PP Totali</span>
          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
            <Sparkles className="w-3 h-3 mr-1" />
            {total_pp} PP
          </Badge>
        </div>

        {/* Tickets Display */}
        <div className="bg-white/5 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-white/70 text-sm">Ticket disponibili</span>
            <span className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
              {tickets_available} / {tickets_total}
            </span>
          </div>

          {/* Progress bar */}
          <Progress value={100 - progressPercent} className="h-2 bg-white/10" />

          <div className="text-xs text-white/50 text-center">
            {tickets_used} ticket usati su {tickets_total} totali
          </div>
        </div>

        {/* Next ticket progress */}
        {tickets_available === 0 && pp_for_next_ticket > 0 && (
          <div className="bg-white/5 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span>Prossimo ticket</span>
            </div>
            <Progress value={ppProgress} className="h-1.5 bg-white/10" />
            <div className="text-xs text-white/50">
              Ti servono altri <span className="text-cyan-400 font-bold">{pp_for_next_ticket} PP</span>
            </div>
          </div>
        )}

        {/* Conversion rate */}
        <div className="text-center text-xs text-white/50">{pp_per_ticket} PP = 1 ticket</div>

        {/* Use Ticket Button */}
        <motion.div
          animate={tickets_available > 0 && !disabled ? { scale: [1, 1.02, 1] } : {}}
          transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2 }}
        >
          <Button
            className={`w-full h-12 text-base font-bold ${
              tickets_available > 0 && !disabled
                ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-500/30"
                : "bg-gray-600/50 text-gray-400 cursor-not-allowed"
            }`}
            onClick={onUseTicket}
            disabled={tickets_available < 1 || isLoading || disabled}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Allocazione...
              </>
            ) : (
              <>
                <Ticket className="w-5 h-5 mr-2" />
                Usa 1 Ticket
              </>
            )}
          </Button>
        </motion.div>

        {tickets_available === 0 && !disabled && (
          <p className="text-center text-xs text-white/50">Guadagna PP giocando per ottenere altri ticket!</p>
        )}
      </CardContent>
    </Card>
  )
}
