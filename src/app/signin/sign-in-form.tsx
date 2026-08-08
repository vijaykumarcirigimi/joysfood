"use client";

import { useActionState } from "react";
import { ArrowLeft, ArrowRight, Loader2, Mail } from "lucide-react";
import { emailAuth, signInWithGoogle } from "@/app/auth/actions";
import { EMAIL_AUTH_INITIAL } from "@/app/auth/email-auth-state";

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(emailAuth, EMAIL_AUTH_INITIAL);

  return (
    <div className="space-y-5">
      {/* Google — a plain form post, so it works before hydration. */}
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <button
          type="submit"
          className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-semibold transition-colors hover:border-border-strong"
        >
          <GoogleMark />
          Continue with Google
        </button>
      </form>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-muted">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={action} className="space-y-3">
        <input type="hidden" name="next" value={next} />

        {state.step === "email" ? (
          <>
            <input type="hidden" name="intent" value="send" />
            <div>
              <label htmlFor="email" className="text-sm font-medium">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                defaultValue={state.email}
                placeholder="you@example.com"
                className="mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
            </div>
          </>
        ) : (
          <>
            <input type="hidden" name="intent" value="verify" />
            <div>
              <label htmlFor="code" className="text-sm font-medium">
                Verification code
              </label>
              <input
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                // Not 6: the length is a dashboard setting. See CodeSchema.
                maxLength={10}
                required
                autoFocus
                placeholder="123456"
                className="mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-center font-mono text-lg tracking-[0.4em] focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
            </div>
          </>
        )}

        {state.notice ? (
          <p className="text-sm text-muted">{state.notice}</p>
        ) : null}

        {state.error ? (
          <p role="alert" className="text-sm text-nonveg">
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-fg transition-colors enabled:hover:bg-primary-hover disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : state.step === "email" ? (
            <Mail className="size-4" aria-hidden />
          ) : (
            <ArrowRight className="size-4" aria-hidden />
          )}
          {state.step === "email" ? "Email me a code" : "Sign in"}
        </button>
      </form>

      {state.step === "code" ? (
        <form action={action}>
          <input type="hidden" name="intent" value="restart" />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Use a different email
          </button>
        </form>
      ) : null}
    </div>
  );
}

/** Lucide carries no brand marks, so the Google G is inline. */
function GoogleMark() {
  return (
    <svg className="size-4" viewBox="0 0 18 18" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.34A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
