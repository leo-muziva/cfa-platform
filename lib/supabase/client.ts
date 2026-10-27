// Supabase client for Client Components (runs in the browser). Uses the
// public publishable key, so everything it does is limited by RLS.
import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "./config";

/** A Supabase client for browser code. */
export function createClient() {
  const config = getSupabasePublicConfig();
  return createBrowserClient(config.url, config.publishableKey);
}
