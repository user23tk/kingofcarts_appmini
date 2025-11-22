import { createAdminClient as createAdminClientInternal } from "@/lib/supabase/admin"
import type { SupabaseClient } from "@supabase/supabase-js"

let adminClientInstance: SupabaseClient | null = null

/**
 * Get or create the singleton admin client instance
 * This prevents creating multiple admin clients and improves performance
 */
export function getAdminClient(): SupabaseClient {
  if (!adminClientInstance) {
    console.log("[v0] Creating new admin client singleton instance")
    adminClientInstance = createAdminClientInternal()
  }
  return adminClientInstance
}

// This ensures all calls to createAdminClient() from this module actually get the singleton
export const createAdminClient = getAdminClient

/**
 * Reset the admin client instance (useful for testing)
 */
export function resetAdminClient(): void {
  adminClientInstance = null
}
