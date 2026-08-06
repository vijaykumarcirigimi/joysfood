import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Shared-password gate for the kitchen dashboard.
 *
 * Deliberately minimal: the kitchen is one or two trusted people on known
 * devices, and a full auth system here would be ceremony. Staff accounts
 * arrive with Supabase Auth in Phase 4 — this is not the model to grow into.
 */
const COOKIE_NAME = "joysfood_kitchen";
const COOKIE_MAX_AGE = 60 * 60 * 12; // one shift

function kitchenPassword(): string {
  return process.env.KITCHEN_PASSWORD ?? "";
}

export function isKitchenConfigured(): boolean {
  return kitchenPassword().length >= 8;
}

/** Constant-time string compare that tolerates differing lengths. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still burn a comparison so length is not leaked by timing.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/** The cookie holds an HMAC of the password, never the password itself. */
function sessionToken(): string {
  return createHmac("sha256", kitchenPassword())
    .update("joysfood-kitchen-v1")
    .digest("hex");
}

export async function isKitchenAuthed(): Promise<boolean> {
  if (!isKitchenConfigured()) return false;
  const cookie = (await cookies()).get(COOKIE_NAME)?.value;
  if (!cookie) return false;
  return safeEqual(cookie, sessionToken());
}

export async function signInKitchen(password: string): Promise<boolean> {
  if (!isKitchenConfigured()) return false;
  if (!safeEqual(password, kitchenPassword())) return false;

  (await cookies()).set(COOKIE_NAME, sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return true;
}

export async function signOutKitchen(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}
