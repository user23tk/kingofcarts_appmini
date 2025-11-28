"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, Users, Trophy, Gift, Smartphone, Settings, Sparkles, Bot, AlertTriangle } from "lucide-react"
import { type DebugCategory, DEBUG_CATEGORIES } from "@/lib/debug/categories"

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Users: <Users className="h-4 w-4" />,
  Trophy: <Trophy className="h-4 w-4" />,
  Gift: <Gift className="h-4 w-4" />,
  Smartphone: <Smartphone className="h-4 w-4" />,
  Settings: <Settings className="h-4 w-4" />,
  Sparkles: <Sparkles className="h-4 w-4" />,
  Bot: <Bot className="h-4 w-4" />,
}

interface CategorySelectorProps {
  selectedCategory: DebugCategory
  onCategoryChange: (category: DebugCategory) => void
}

export function CategorySelector({ selectedCategory, onCategoryChange }: CategorySelectorProps) {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full md:w-[280px] justify-between bg-transparent">
          <span className="flex items-center gap-2">
            {CATEGORY_ICONS[selectedCategory.icon]}
            {selectedCategory.label}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[280px]" align="start">
        {DEBUG_CATEGORIES.map((category, index) => (
          <div key={category.id}>
            {category.isLegacy && index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={() => {
                onCategoryChange(category)
                setOpen(false)
              }}
              className={`flex items-center gap-2 ${category.isLegacy ? "text-muted-foreground" : ""}`}
            >
              {CATEGORY_ICONS[category.icon]}
              <span className="flex-1">{category.label}</span>
              {category.isLegacy && (
                <Badge variant="outline" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Legacy
                </Badge>
              )}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
