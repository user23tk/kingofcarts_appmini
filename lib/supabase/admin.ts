import { createClient } from "@supabase/supabase-js"

/**
 * Admin Supabase client for Mini App APIs
 * Uses SERVICE_ROLE_KEY to bypass RLS since authentication is handled by Telegram WebApp
 *
 * IMPORTANT: Only use this in server-side API routes, never expose to client
 */
export function createAdminClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL")
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY")
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: (url, options) => {
        return fetch(url, {
          ...options,
          cache: "no-store",
        })
      },
    },
  })
}
