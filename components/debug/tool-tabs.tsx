"use client"

import { Button } from "@/components/ui/button"
import type { DebugTool } from "@/lib/debug/categories"
import { cn } from "@/lib/utils"

interface ToolTabsProps {
  tools: DebugTool[]
  selectedTool: string
  onToolChange: (toolId: string) => void
}

export function ToolTabs({ tools, selectedTool, onToolChange }: ToolTabsProps) {
  return (
    <div className="flex flex-wrap gap-2 border-b pb-4">
      {tools.map((tool) => (
        <Button
          key={tool.id}
          variant={selectedTool === tool.id ? "default" : "outline"}
          size="sm"
          onClick={() => onToolChange(tool.id)}
          className={cn("transition-all", selectedTool === tool.id && "shadow-md")}
        >
          {tool.label}
        </Button>
      ))}
    </div>
  )
}
