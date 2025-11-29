// Giveaway Types for TypeScript

export interface Giveaway {
  id: string
  theme_id: string | null
  name: string
  description: string | null
  pp_per_ticket: number
  tickets_per_entry: number
  starts_at: string
  ends_at: string
  is_active: boolean
  prize_title: string
  prize_type: "telegram_gift" | "product_box" | "stars" | "premium" | "other"
  prize_description: string | null
  prize_image_url: string | null
  prize_link: string | null
  created_at: string
  updated_at: string
  // Computed fields from RPC
  time_remaining_ms?: number
  has_ended?: boolean
  has_winner?: boolean
  theme?: {
    id: string
    name: string
    title: string
    emoji: string | null
  } | null
}

export interface GiveawayEntry {
  id: string
  giveaway_id: string
  user_id: string
  ticket_number: number
  created_at: string
}

export interface GiveawayResult {
  id: string
  giveaway_id: string
  winner_user_id: string
  winning_ticket_number: number
  drawn_at: string
  drawn_by_admin_id: string | null
  notes: string | null
}

export interface UserTicketData {
  total_pp: number
  pp_per_ticket: number
  tickets_total: number
  tickets_used: number
  tickets_available: number
  pp_for_next_ticket: number
  ticket_numbers: Array<{
    ticket_number: number
    created_at: string
  }>
  onboarding_bonus_claimed?: boolean
}

export interface GiveawayWinner {
  user_id: string
  ticket_number: number
  username: string | null
  display_name: string
  drawn_at: string
  is_current_user: boolean
}

export interface GiveawayWithUserData {
  giveaway: Giveaway | null
  user_data: UserTicketData | null
  winner: GiveawayWinner | null
  message?: string
}

export interface AllocateTicketResponse {
  success: boolean
  ticket_number?: number
  new_balance?: UserTicketData
  error?: string
}

export interface OnboardingBonusResponse {
  success: boolean
  bonus_amount?: number
  new_total_pp?: number
  reason?: string
  total_pp?: number
}

export interface GiveawayStats {
  giveaway_id: string
  name: string
  is_active: boolean
  starts_at: string
  ends_at: string
  unique_participants: number
  total_entries: number
  first_ticket: number | null
  last_ticket: number | null
  avg_tickets_per_user: number | null
}

export interface DrawWinnerResponse {
  success: boolean
  winner?: {
    user_id: string
    telegram_id: string
    username: string | null
    first_name: string | null
    last_name: string | null
    ticket_number: number
  }
  giveaway_id?: string
  giveaway_name?: string
  total_entries?: number
  drawn_at?: string
  error?: string
}
