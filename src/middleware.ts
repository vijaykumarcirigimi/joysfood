import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session on every navigation.
 *
 * Access tokens expire in an hour. Server Components can read cookies but not
 * write them, so without this a signed-in customer would silently become a
 * guest mid-session — and, worse, would look signed in until the next server
 * render disagreed with the browser.
 *
 * Deliberately the only place that rotates auth cookies. `/auth/*` is excluded
 * below because the callback route is mid-handshake: refreshing there races the
 * PKCE code exchange for the same cookie.
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Supabase is optional until it is configured — see lib/supabase/env.ts.
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Written twice on purpose: onto the request so this render sees the
        // fresh token, and onto the response so the browser keeps it.
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser(), not getSession() — this validates the token with the auth
  // server, and validating is what triggers the refresh.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and the auth handshake. Note this does
     * not defeat ISR on the menu pages: middleware runs in front of the cache,
     * the cached HTML is still served.
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|auth/|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
