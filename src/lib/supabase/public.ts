import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabaseConfig } from "./env";

/**
 * Cookie-free client for public, cacheable reads (the menu).
 *
 * Deliberately separate from the cookie-aware server client: touching
 * cookies() would opt the menu page out of static rendering, and the menu is
 * the one page that should be cached hard.
 */
export function createSupabasePublicClient() {
  if (!hasSupabaseConfig) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
