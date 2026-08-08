"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabaseConfig } from "./env";

let client: SupabaseClient | null = null;

/**
 * Browser client, used for one job only: telling the header who is signed in.
 *
 * The header lives on the menu pages, which are ISR (`revalidate = 60`).
 * Reading the session on the server would touch cookies and force those pages
 * dynamic, so the account state is hydrated client-side instead. Everything
 * that actually *matters* — order history, checkout prefill, order ownership —
 * is decided on the server from the cookie, never from this client.
 */
export function createSupabaseBrowserClient(): SupabaseClient | null {
  if (!hasSupabaseConfig) return null;
  client ??= createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
