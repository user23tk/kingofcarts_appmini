"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Gift, ExternalLink, Star, Crown, Package } from "lucide-react"
import { motion } from "framer-motion"
import Image from "next/image"

interface PrizeCardProps {
  title: string
  type: "telegram_gift" | "product_box" | "stars" | "premium" | "other"
  description: string | null
  imageUrl: string | null
  prizeLink: string | null
}

const PRIZE_ICONS = {
  telegram_gift: Gift,
  product_box: Package,
  stars: Star,
  premium: Crown,
  other: Gift,
}

const PRIZE_LABELS = {
  telegram_gift: "Telegram Gift",
  product_box: "Product Box",
  stars: "Telegram Stars",
  premium: "Premium",
  other: "Premio",
}

export function PrizeCard({ title, type, description, imageUrl, prizeLink }: PrizeCardProps) {
  const Icon = PRIZE_ICONS[type] || Gift
  const label = PRIZE_LABELS[type] || "Premio"

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
      <Card className="relative overflow-hidden bg-gradient-to-br from-purple-900/50 to-pink-900/50 backdrop-blur-md border border-purple-500/30 hover:border-purple-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20">
        {/* Glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-cyan-600/20 blur-xl opacity-50" />

        <CardContent className="relative z-10 p-4">
          {/* Prize image */}
          <div className="relative w-full aspect-square max-h-48 mb-4 rounded-lg overflow-hidden bg-white/5">
            {imageUrl ? (
              <Image
                src={imageUrl || "/placeholder.svg"}
                alt={title}
                fill
                className="object-contain p-4"
                sizes="(max-width: 768px) 100vw, 300px"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Icon className="w-20 h-20 text-purple-400/50" />
              </div>
            )}
          </div>

          {/* Prize info */}
          <div className="space-y-2">
            <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 border-purple-500/30">
              <Icon className="w-3 h-3 mr-1" />
              {label}
            </Badge>

            <h3 className="text-lg font-bold text-white">{title}</h3>

            {description && <p className="text-sm text-white/70 line-clamp-2">{description}</p>}

            {prizeLink && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2 border-purple-500/50 text-purple-300 hover:bg-purple-500/20 bg-transparent"
                onClick={() => window.open(prizeLink, "_blank")}
              >
                Vedi premio
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
