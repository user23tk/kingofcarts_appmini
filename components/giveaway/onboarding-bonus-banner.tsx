"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Gift, Sparkles, Loader2, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface OnboardingBonusBannerProps {
  onClaim: () => Promise<any>
  isLoading: boolean
}

export function OnboardingBonusBanner({ onClaim, isLoading }: OnboardingBonusBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const [claimed, setClaimed] = useState(false)

  const handleClaim = async () => {
    const result = await onClaim()
    if (result?.success) {
      setClaimed(true)
      setTimeout(() => setDismissed(true), 2000)
    }
  }

  if (dismissed) return null

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
        <Card
          className={`relative overflow-hidden ${
            claimed
              ? "bg-gradient-to-r from-green-500/30 to-emerald-500/30 border-green-500/50"
              : "bg-gradient-to-r from-yellow-500/30 via-orange-500/20 to-pink-500/30 border-yellow-500/50"
          } backdrop-blur-md`}
        >
          {/* Animated glow */}
          {!claimed && (
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 via-transparent to-yellow-500/20 animate-pulse" />
          )}

          <CardContent className="relative z-10 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    claimed ? "bg-green-500/30" : "bg-gradient-to-br from-yellow-500 to-orange-500"
                  }`}
                >
                  {claimed ? <Sparkles className="w-5 h-5 text-green-300" /> : <Gift className="w-5 h-5 text-white" />}
                </div>
                <div>
                  {claimed ? (
                    <>
                      <p className="font-bold text-green-300">+200 PP Ricevuti!</p>
                      <p className="text-xs text-green-200/70">Bonus aggiunto al tuo account</p>
                    </>
                  ) : (
                    <>
                      <p className="font-bold text-yellow-300">Bonus Benvenuto</p>
                      <p className="text-xs text-white/70">Ricevi +200 PP gratis!</p>
                    </>
                  )}
                </div>
              </div>

              {!claimed && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white font-bold"
                    onClick={handleClaim}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-1" />
                        Riscatta
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-white/50 hover:text-white hover:bg-white/10"
                    onClick={() => setDismissed(true)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  )
}
