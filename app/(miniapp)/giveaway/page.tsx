"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowLeft, Gift, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AnimatedBackground } from "@/components/miniapp/animated-background"
import { GiveawayHeader } from "@/components/giveaway/giveaway-header"
import { PrizeCard } from "@/components/giveaway/prize-card"
import { TicketBalance } from "@/components/giveaway/ticket-balance"
import { UserEntries } from "@/components/giveaway/user-entries"
import { WinnerBanner } from "@/components/giveaway/winner-banner"
import { OnboardingBonusBanner } from "@/components/giveaway/onboarding-bonus-banner"
import { useGiveaway } from "@/lib/giveaway/use-giveaway"
import { useBackButton, hapticFeedback, useTelegramWebApp } from "@/lib/telegram/webapp-client"
import { useToast } from "@/hooks/use-toast"

export default function GiveawayPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { initData } = useTelegramWebApp()
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(false)

  const {
    giveaway,
    userData,
    winner,
    isLoading,
    error,
    useTicket,
    isUsingTicket,
    claimOnboardingBonus,
    isClaimingBonus,
  } = useGiveaway(initData)

  const handleUseTicket = async () => {
    hapticFeedback("medium")
    try {
      const result = await useTicket()
      if (result?.success) {
        hapticFeedback("success")
        toast({
          title: `Ticket #${result.ticket_number} assegnato!`,
          description: "Buona fortuna per l'estrazione!",
        })
      }
    } catch (err) {
      hapticFeedback("error")
      toast({
        title: "Errore",
        description: err instanceof Error ? err.message : "Impossibile allocare il ticket",
        variant: "destructive",
      })
    }
  }

  const handleClaimBonus = async () => {
    hapticFeedback("medium")
    try {
      const result = await claimOnboardingBonus()
      if (result?.success) {
        hapticFeedback("success")
        toast({
          title: `+${result.bonus_amount} PP Bonus!`,
          description: "Benvenuto nel gioco!",
        })
        setShowOnboardingBanner(false)
      } else if (result?.reason === "bonus_already_claimed") {
        setShowOnboardingBanner(false)
      }
      return result
    } catch (err) {
      hapticFeedback("error")
      toast({
        title: "Errore",
        description: "Impossibile riscattare il bonus",
        variant: "destructive",
      })
      return null
    }
  }

  useBackButton(() => {
    router.push("/")
  })

  useEffect(() => {
    if (userData && userData.total_pp === 0) {
      const dismissed = localStorage.getItem("onboarding_bonus_dismissed")
      if (!dismissed) {
        setShowOnboardingBanner(true)
      }
    }
  }, [userData])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Caricamento...</p>
        </div>
      </div>
    )
  }

  if (error || !giveaway) {
    return (
      <div className="relative min-h-screen pb-20">
        <AnimatedBackground theme="fantasy" intensity="low" variant="menu" />
        <div className="relative z-10 p-4">
          <div className="mb-6 flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                hapticFeedback("light")
                router.push("/")
              }}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Giveaway</h1>
              <p className="text-sm text-muted-foreground">Premi e Contest</p>
            </div>
          </div>

          <Card className="bg-background/80 backdrop-blur-sm">
            <CardContent className="py-12 text-center">
              <Gift className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-lg font-medium mb-2">Nessun Giveaway Attivo</h3>
              <p className="text-sm text-muted-foreground">Al momento non ci sono contest attivi. Torna presto!</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen pb-24">
      <AnimatedBackground theme="fantasy" intensity="low" variant="menu" />

      <div className="relative z-10 p-4 space-y-4">
        {/* Header with back button */}
        <div className="flex items-center space-x-4 mb-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              hapticFeedback("light")
              router.push("/")
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Giveaway</h1>
            <p className="text-sm text-muted-foreground">Partecipa e vinci!</p>
          </div>
        </div>

        {/* Onboarding Bonus Banner */}
        {showOnboardingBanner && <OnboardingBonusBanner onClaim={handleClaimBonus} isLoading={isClaimingBonus} />}

        {/* Giveaway Header with countdown */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <GiveawayHeader
            name={giveaway.name}
            endsAt={giveaway.ends_at}
            isActive={giveaway.is_active}
            hasEnded={giveaway.has_ended || false}
            hasWinner={giveaway.has_winner || false}
            themeEmoji={giveaway.theme?.emoji}
          />
        </motion.div>

        {/* Winner Banner (if winner exists) */}
        {winner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <WinnerBanner winner={winner} />
          </motion.div>
        )}

        {/* Prize Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <PrizeCard
            title={giveaway.prize_title}
            type={giveaway.prize_type}
            description={giveaway.prize_description}
            imageUrl={giveaway.prize_image_url}
            prizeLink={giveaway.prize_link}
          />
        </motion.div>

        {/* Ticket Balance */}
        {userData && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <TicketBalance
              userData={userData}
              onUseTicket={handleUseTicket}
              isLoading={isUsingTicket}
              disabled={!giveaway.is_active || giveaway.has_ended || !!winner}
            />
          </motion.div>
        )}

        {/* User Entries */}
        {userData && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <UserEntries entries={userData.ticket_numbers} />
          </motion.div>
        )}

        {/* How it works */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-gradient-to-br from-purple-900/20 to-indigo-900/20 backdrop-blur-sm border border-purple-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-white/80">
                <HelpCircle className="w-4 h-4" />
                Come Funziona
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm text-white/60">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500/30 flex items-center justify-center text-xs text-purple-300">
                    1
                  </span>
                  <span>Guadagna PP giocando alle storie</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500/30 flex items-center justify-center text-xs text-purple-300">
                    2
                  </span>
                  <span>Ogni {giveaway.pp_per_ticket} PP = 1 ticket</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500/30 flex items-center justify-center text-xs text-purple-300">
                    3
                  </span>
                  <span>Usa i ticket per partecipare all'estrazione</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500/30 flex items-center justify-center text-xs text-purple-300">
                    4
                  </span>
                  <span>Vinci il premio!</span>
                </li>
              </ol>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
