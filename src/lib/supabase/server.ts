import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabaseConfig } from "./env";

/**
 * Cookie-aware server client — carries the signed-in user's session.
 * Used from Phase 4 onward (checkout, order history, admin).
 */
export async function createSupabaseServerClient() {
  if (!hasSupabaseConfig) return null;
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Middleware refreshes the session instead — safe to ignore.
        }
      },
    },
  });
}
