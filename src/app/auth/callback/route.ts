import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNext, siteOrigin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Where every out-of-app sign-in lands.
 *
 * Two shapes arrive here:
 *   ?code=…                  Google OAuth, and email magic links (PKCE)
 *   ?token_hash=…&type=email  email links from the default Supabase template
 *
 * Both are handled so the flow works whether or not the project's email
 * template has been switched over to send a bare {{ .Token }} code.
 *
 * A Route Handler can write cookies, which is what makes it the right place to
 * turn a one-time code into a session.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = await siteOrigin();

  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(requestUrl.searchParams.get("next"));

  // The provider reports a refusal (consent denied, expired link) in the query.
  const providerError =
    requestUrl.searchParams.get("error_description") ??
    requestUrl.searchParams.get("error");

  const fail = (reason: string) =>
    NextResponse.redirect(
      new URL(`/signin?error=${encodeURIComponent(reason)}`, origin),
    );

  if (providerError) {
    console.error("[auth] provider returned an error:", providerError);
    return fail("provider");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return fail("unconfigured");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth] code exchange failed:", error);
      return fail("link");
    }
    return NextResponse.redirect(new URL(next, origin));
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (error) {
      console.error("[auth] token_hash verify failed:", error);
      return fail("link");
    }
    return NextResponse.redirect(new URL(next, origin));
  }

  return fail("link");
}
