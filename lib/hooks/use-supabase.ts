"use client"

import { createClient as createBrowserClient } from "@/lib/supabase/browser"
import { createClient as createServerClient } from "@/lib/supabase/server"
import { useMemo } from "react"

/**
 * Hook centralizzato per la creazione del client Supabase browser-side
 * Usa memoization per evitare ricreazioni inutili
 */
export function useSupabaseBrowser() {
  return useMemo(() => createBrowserClient(), [])
}

/**
 * Utility per creare client Supabase server-side
 * Centralizza la logica di creazione per consistenza
 */
export async function getSupabaseServer() {
  return await createServerClient()
}
