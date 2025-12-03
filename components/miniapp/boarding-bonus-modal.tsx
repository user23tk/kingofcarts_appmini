"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Sparkles, Gift } from "lucide-react"
import { motion } from "framer-motion"
import { hapticFeedback } from "@/lib/telegram/webapp-client"

interface OnboardingBonusModalProps {
  userId: string
  onClaimed?: () => void
}

interface BonusStatus {
  can_claim: boolean
  already_claimed: boolean
  total_pp: number
  giveaway_active: boolean
  reason?: string
}

export function OnboardingBonusModal({ userId, onClaimed }: OnboardingBonusModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isClaiming, setIsClaiming] = useState(false)
  const [bonusStatus, setBonusStatus] = useState<BonusStatus | null>(null)

  useEffect(() => {
    checkBonusStatus()
  }, [userId])

  const checkBonusStatus = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/miniapp/onboarding/bonus?userId=${userId}`)
      
      if (!response.ok) {
        console.error("[OnboardingBonus] Failed to check status")
        return
      }

      const data = await response.json()
      setBonusStatus(data)

      // Show modal if user can claim
      if (data.can_claim && data.giveaway_active) {
        setIsOpen(true)
        hapticFeedback("medium")
      }
    } catch (error) {
      console.error("[OnboardingBonus] Error checking status:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClaim = async () => {
    try {
      setIsClaiming(true)
      hapticFeedback("medium")

      const response = await fetch("/api/miniapp/onboarding/bonus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })

      const data = await response.json()

      if (data.success) {
        hapticFeedback("heavy")
        setIsOpen(false)
        
        // Wait a bit before calling onClaimed to show success state
        setTimeout(() => {
          onClaimed?.()
        }, 500)
      } else {
        console.error("[OnboardingBonus] Failed to claim:", data.reason)
        hapticFeedback("error")
      }
    } catch (error) {
      console.error("[OnboardingBonus] Error claiming bonus:", error)
      hapticFeedback("error")
    } finally {
      setIsClaiming(false)
    }
  }

  if (!bonusStatus?.can_claim || !bonusStatus?.giveaway_active) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-orange-500"
          >
            <Gift className="h-10 w-10 text-white" />
          </motion.div>
          <DialogTitle className="text-center text-2xl">
            🎉 Benvenuto!
          </DialogTitle>
          <DialogDescription className="text-center">
            C'è un giveaway attivo e hai diritto a un bonus speciale!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500/50 p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="h-6 w-6 text-yellow-500" />
              <p className="text-4xl font-bold text-yellow-500">+200 PP</p>
              <Sparkles className="h-6 w-6 text-yellow-500" />
            </div>
            <p className="text-sm text-muted-foreground">
              Bonus Onboarding
            </p>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>Reclama il tuo bonus per iniziare la tua avventura con 200 Power Points!</p>
            <p className="mt-2 font-medium">✨ Disponibile solo per nuovi utenti durante il giveaway</p>
          </div>

          <Button
            onClick={handleClaim}
            disabled={isClaiming}
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold text-lg h-12"
          >
            {isClaiming ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Claiming...
              </div>
            ) : (
              <>
                <Gift className="mr-2 h-5 w-5" />
                Reclama Bonus!
              </>
            )}
          </Button>

          <Button
            onClick={() => setIsOpen(false)}
            variant="ghost"
            className="w-full"
            disabled={isClaiming}
          >
            Forse più tardi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
