import "server-only";

import { headers } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The signed-in customer, or null. Never throws — a missing session is the
 * normal case, not an error, because guest checkout is a supported path.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  // getUser() verifies the JWT against the auth server. getSession() would
  // only decode the cookie, which the browser could have written.
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}

/** Best available human name: Google profile → email local part → "there". */
export function displayName(user: User): string {
  const meta = user.user_metadata ?? {};
  const named =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    "";
  if (named.trim()) return named.trim();
  const local = user.email?.split("@")[0] ?? "";
  return local || "there";
}

/** Single letter for the header avatar. */
export function avatarInitial(user: User): string {
  return displayName(user).charAt(0).toUpperCase() || "?";
}

/**
 * Absolute origin for OAuth and email redirect targets.
 *
 * Supabase needs a fully-qualified URL, and it must be the *public* one —
 * behind Vercel's proxy `host` is the internal hostname, so the forwarded
 * headers win. NEXT_PUBLIC_SITE_URL overrides both when set.
 */
export async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;

  const h = await headers();
  const host =
    h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  return `${proto}://${host}`;
}

/**
 * Only ever redirect to our own paths. An open redirect on a sign-in flow is
 * how a crafted link lands someone on an attacker's lookalike checkout.
 */
export function safeNext(value: unknown, fallback = "/"): string {
  const next = typeof value === "string" ? value : "";
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
