"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext, siteOrigin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  EMAIL_AUTH_INITIAL,
  type EmailAuthState,
} from "./email-auth-state";

const NOT_CONFIGURED = "Sign-in is not configured yet.";

/**
 * Google OAuth, started server-side.
 *
 * signInWithOAuth() writes the PKCE code verifier into a cookie and hands back
 * the consent URL. Doing it here rather than in the browser means the verifier
 * is set by the same cookie adapter that /auth/callback later reads it with.
 */
export async function signInWithGoogle(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/signin?error=unconfigured");

  const next = safeNext(formData.get("next"));
  const origin = await siteOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      // We redirect ourselves — the helper cannot, there is no window here.
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    console.error("[auth] google sign-in failed:", error);
    redirect("/signin?error=google");
  }

  redirect(data.url);
}

// ---------------------------------------------------------------------------
// Email one-time code
// ---------------------------------------------------------------------------

const EmailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));
/**
 * Code length is a project setting, not a constant: Authentication → Providers
 * → Email → "Email OTP length". Hard-coding 6 here means someone changing that
 * field in the dashboard silently breaks every sign-in, with the app blaming
 * the customer's typing. Accept the range Supabase permits instead.
 */
const CodeSchema = z
  .string()
  .trim()
  .regex(/^\d{4,10}$/, "Enter the numeric code from your email");

/**
 * One action drives both steps so the server owns which step we are on — a
 * client-held step can disagree with reality after a failed verify.
 *
 * Sign-up and sign-in are the same flow on purpose: `shouldCreateUser` means a
 * first-time email becomes an account on first successful code entry. There is
 * no separate registration form to keep in sync, and no password to reset.
 */
export async function emailAuth(
  prev: EmailAuthState,
  formData: FormData,
): Promise<EmailAuthState> {
  const intent = String(formData.get("intent") ?? "");
  const next = safeNext(formData.get("next"));

  if (intent === "restart") return EMAIL_AUTH_INITIAL;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ...prev, error: NOT_CONFIGURED, notice: null };

  if (intent === "send") {
    const email = EmailSchema.safeParse(formData.get("email"));
    if (!email.success) {
      return {
        ...prev,
        step: "email",
        error: email.error.issues[0]?.message ?? "Enter a valid email address",
        notice: null,
      };
    }

    const origin = await siteOrigin();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.data,
      options: {
        shouldCreateUser: true,
        // Covers the case where the Supabase email template still sends a
        // magic link rather than a bare {{ .Token }} code.
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      console.error("[auth] otp request failed:", error);
      return {
        step: "email",
        email: email.data,
        // Supabase's own wording here is customer-appropriate and specific
        // ("you can only request this after 47 seconds") — better than ours.
        error: error.message || "We couldn't send that code. Please try again.",
        notice: null,
      };
    }

    return {
      step: "code",
      email: email.data,
      error: null,
      notice: `We sent a sign-in code to ${email.data}.`,
    };
  }

  if (intent === "verify") {
    const email = EmailSchema.safeParse(prev.email);
    if (!email.success) return EMAIL_AUTH_INITIAL;

    const code = CodeSchema.safeParse(formData.get("code"));
    if (!code.success) {
      return {
        ...prev,
        step: "code",
        error: code.error.issues[0]?.message ?? "Enter the 6-digit code",
        notice: null,
      };
    }

    const { error } = await supabase.auth.verifyOtp({
      email: email.data,
      token: code.data,
      type: "email",
    });

    if (error) {
      console.error("[auth] otp verify failed:", error);
      return {
        step: "code",
        email: email.data,
        error: error.message || "That code didn't work. Try again.",
        notice: null,
      };
    }

    // Checkout prefills from the session, so its cached render is now stale.
    revalidatePath("/cart");
    redirect(next);
  }

  return prev;
}
