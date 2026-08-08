"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { LogOut, ReceiptText, User as UserIcon } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Account control in the header.
 *
 * Reads the session in the browser rather than on the server, so the menu and
 * category pages keep their `revalidate = 60` ISR. Nothing here gates access —
 * /orders re-checks the session server-side, and order ownership is enforced by
 * RLS. This is presentation only.
 */
export function AccountMenu() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user ?? null);
      setLoading(false);
    });

    // Keeps the avatar honest across tabs, token refreshes and sign-out.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    setOpen(false);
    // The cookie is gone; make the server components agree.
    router.refresh();
    router.push("/");
  }

  if (loading) {
    return (
      <div
        className="size-9 shrink-0 animate-pulse rounded-full bg-surface-alt"
        aria-hidden
      />
    );
  }

  if (!user) {
    return (
      <Link
        href="/signin"
        className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 text-sm font-medium transition-colors hover:border-border-strong sm:px-4"
      >
        <UserIcon className="size-4 text-primary" aria-hidden />
        <span className="hidden sm:inline">Sign in</span>
      </Link>
    );
  }

  const name = pickName(user);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-fg"
      >
        {name.charAt(0).toUpperCase()}
      </button>

      {open ? (
        <>
          {/* Click-away layer — cheaper and more reliable than a document
              listener that has to ignore the toggle button itself. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />

          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
          >
            <div className="border-b border-border px-4 py-3">
              <p className="truncate text-sm font-semibold">{name}</p>
              {user.email ? (
                <p className="truncate text-xs text-muted">{user.email}</p>
              ) : null}
            </div>

            <Link
              href="/orders"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-3 text-sm font-medium transition-colors hover:bg-surface-alt"
            >
              <ReceiptText className="size-4 text-muted" aria-hidden />
              Your orders
            </Link>

            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2.5 border-t border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-surface-alt"
            >
              <LogOut className="size-4 text-muted" aria-hidden />
              Sign out
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Google gives us a name; email-only sign-ups get their local part. */
function pickName(user: User): string {
  const meta = user.user_metadata ?? {};
  const named =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    "";
  if (named.trim()) return named.trim();
  return user.email?.split("@")[0] || "Account";
}
