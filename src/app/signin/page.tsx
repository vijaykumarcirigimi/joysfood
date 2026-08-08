import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { SiteFooter } from "@/components/site-footer";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

// Reads the session to bounce already-signed-in visitors.
export const dynamic = "force-dynamic";

const ERROR_COPY: Record<string, string> = {
  google: "We couldn't reach Google just then. Please try again.",
  link: "That sign-in link has expired or has already been used.",
  provider: "The sign-in was cancelled.",
  unconfigured: "Sign-in is not configured yet.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);

  const user = await getCurrentUser();
  if (user) redirect(next);

  const error = params.error ? ERROR_COPY[params.error] ?? ERROR_COPY.link : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="text-center">
            <Link href="/" aria-label="Joy's Food home" className="inline-block">
              <BrandMark />
            </Link>
            <h1 className="mt-6 font-display text-2xl font-bold tracking-tight">
              Sign in to Joy&rsquo;s Food
            </h1>
            <p className="mt-2 text-sm text-muted">
              Track your orders and check out faster. No password to remember.
            </p>
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-6 flex items-start gap-2 rounded-xl border border-nonveg/40 bg-nonveg/10 px-3 py-2.5 text-sm text-nonveg"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}

          {hasSupabaseConfig ? (
            <div className="mt-7">
              <SignInForm next={next} />
            </div>
          ) : (
            <p className="mt-7 flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm text-muted">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              Supabase is not configured, so sign-in is unavailable. You can
              still order as a guest.
            </p>
          )}

          <p className="mt-7 text-center text-xs text-muted">
            You don&rsquo;t need an account to order —{" "}
            <Link href="/cart" className="font-medium text-primary hover:underline">
              check out as a guest
            </Link>
            .
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
