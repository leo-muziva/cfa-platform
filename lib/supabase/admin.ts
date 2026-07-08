import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Admin client using the SECRET (service-role) key. It bypasses RLS, so it
 * must ONLY ever be imported from server-side code (repositories) — never
 * from anything reachable by the browser.
 *
 * Returns null when the secret key is not configured so callers can degrade
 * gracefully instead of crashing at import time.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!url || !secretKey) return null

  return createSupabaseClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
