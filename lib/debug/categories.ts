// Debug tool categories configuration
// Based on UI_RESTRUCTURE_VISUAL.md specifications

export type DebugCategory = {
  id: string
  label: string
  icon: string
  description: string
  tools: DebugTool[]
  isLegacy?: boolean
}

export type DebugTool = {
  id: string
  label: string
  description: string
}

export const DEBUG_CATEGORIES: DebugCategory[] = [
  {
    id: "users",
    label: "Users & Progress",
    icon: "Users",
    description: "User management, validation and progress tracking",
    tools: [
      { id: "database", label: "User List", description: "View and manage all users" },
      { id: "user-validator", label: "User Inspector", description: "Validate individual user data" },
      { id: "validator", label: "Stats Validator", description: "Validate progress consistency" },
    ],
  },
  {
    id: "leaderboard",
    label: "Leaderboard & PP",
    icon: "Trophy",
    description: "Rankings, PP calculations and global stats",
    tools: [
      { id: "rank", label: "Rank Debugger", description: "Test user rankings and PP" },
      { id: "stats", label: "Global Stats", description: "View system-wide statistics" },
    ],
  },
  {
    id: "events",
    label: "Events & Giveaways",
    icon: "Gift",
    description: "Manage events, contests and giveaways",
    tools: [
      { id: "events", label: "Events Manager", description: "Create and manage events" },
      { id: "giveaway", label: "Giveaway Manager", description: "Manage giveaways and drawings" },
    ],
  },
  {
    id: "miniapp",
    label: "Mini App Testing",
    icon: "Smartphone",
    description: "Test mini app functionality and rate limits",
    tools: [
      { id: "miniapp", label: "Mini App Tester", description: "Test mini app endpoints" },
      { id: "health", label: "System Health", description: "Monitor system status" },
    ],
  },
  {
    id: "system",
    label: "System & Maintenance",
    icon: "Settings",
    description: "System configuration and maintenance tools",
    tools: [
      { id: "health", label: "System Health", description: "Monitor system status" },
      { id: "migration", label: "Migration Tools", description: "Data migration utilities" },
    ],
  },
  {
    id: "content",
    label: "Content Tools",
    icon: "Sparkles",
    description: "Story generation and content import",
    tools: [
      { id: "generator", label: "Story AI Generator", description: "Generate stories with AI" },
      { id: "import", label: "JSON Import", description: "Import content from JSON" },
    ],
  },
  {
    id: "legacy",
    label: "Legacy Bot Tools",
    icon: "Bot",
    description: "Old bot configuration (deprecated)",
    isLegacy: true,
    tools: [
      { id: "testing", label: "Webhook Simulator", description: "Test webhook messages" },
      { id: "webhook", label: "Webhook Config", description: "Configure webhook settings" },
      { id: "commands", label: "Commands Config", description: "Configure bot commands" },
    ],
  },
]

export function getCategoryById(categoryId: string): DebugCategory | undefined {
  return DEBUG_CATEGORIES.find((cat) => cat.id === categoryId)
}

export function getToolById(toolId: string): { category: DebugCategory; tool: DebugTool } | undefined {
  for (const category of DEBUG_CATEGORIES) {
    const tool = category.tools.find((t) => t.id === toolId)
    if (tool) {
      return { category, tool }
    }
  }
  return undefined
}
