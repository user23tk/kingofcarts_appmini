"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Ticket, Calendar } from "lucide-react"
import { motion } from "framer-motion"

interface UserEntriesProps {
  entries: Array<{
    ticket_number: number
    created_at: string
  }>
}

export function UserEntries({ entries }: UserEntriesProps) {
  if (entries.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-purple-900/30 to-indigo-900/30 backdrop-blur-md border border-purple-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            <Ticket className="w-5 h-5 text-purple-400" />
            Le Tue Entry
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-white/50">
            <Ticket className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nessun ticket ancora.</p>
            <p className="text-xs mt-1">Usa i tuoi ticket sopra per partecipare!</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-gradient-to-br from-purple-900/30 to-indigo-900/30 backdrop-blur-md border border-purple-500/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg text-white">
          <Ticket className="w-5 h-5 text-purple-400" />
          Le Tue Entry ({entries.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-48">
          <div className="space-y-2">
            {entries.map((entry, index) => (
              <motion.div
                key={entry.ticket_number}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center">
                    <Ticket className="w-5 h-5 text-cyan-400" />
                  </div>
                  <span className="font-mono text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                    #{entry.ticket_number}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-white/50">
                  <Calendar className="w-3 h-3" />
                  {new Date(entry.created_at).toLocaleDateString("it-IT", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
