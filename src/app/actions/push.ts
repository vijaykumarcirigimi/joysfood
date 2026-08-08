"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isKitchenAuthed } from "@/lib/kitchen-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Storing and removing push subscriptions.
 *
 * The `audience` is decided here, never taken from the browser. A page that
 * asked to register as 'staff' would otherwise be able to sign its own device up
 * for every new-order alert — the endpoint is a delivery capability, and handing
 * one out is the whole attack.
 */

const SubscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  p256dh: z.string().min(10).max(500),
  auth: z.string().min(3).max(500),
  label: z.string().trim().max(80).optional(),
  /** Only meaningful for a guest subscribing to one order. */
  orderToken: z.uuid().optional(),
});

export type SubscribeResult = { ok: true } | { ok: false; error: string };

async function upsert(row: Record<string, unknown>): Promise<SubscribeResult> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false, error: "Notifications are not configured." };

  // Upsert on endpoint: a browser that re-subscribes returns the same endpoint,
  // and duplicates would mean the same device buzzing twice per order.
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(row, { onConflict: "endpoint" });

  if (error) {
    console.error("[push] subscribe failed:", error);
    return { ok: false, error: "Could not turn on notifications." };
  }
  return { ok: true };
}

/** Registers the current browser for new-order alerts. Kitchen password only. */
export async function subscribeStaff(input: unknown): Promise<SubscribeResult> {
  if (!(await isKitchenAuthed())) {
    return { ok: false, error: "Sign in to the kitchen first." };
  }

  const parsed = SubscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid subscription." };

  return upsert({
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.p256dh,
    auth: parsed.data.auth,
    audience: "staff",
    label: parsed.data.label ?? null,
    last_used_at: new Date().toISOString(),
    failures: 0,
  });
}

/**
 * Registers the current browser for updates to one order.
 *
 * Signed-in customers are also linked by user_id so a new device still gets
 * updates for orders it never placed. Guests get the order token only — that is
 * all they have, and it is scoped to the one order they hold.
 */
export async function subscribeCustomer(input: unknown): Promise<SubscribeResult> {
  const parsed = SubscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid subscription." };
  if (!parsed.data.orderToken) {
    return { ok: false, error: "Missing order." };
  }

  const user = await getCurrentUser();

  return upsert({
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.p256dh,
    auth: parsed.data.auth,
    audience: "customer",
    user_id: user?.id ?? null,
    order_token: parsed.data.orderToken,
    label: parsed.data.label ?? null,
    last_used_at: new Date().toISOString(),
    failures: 0,
  });
}

/** Removes this browser. Called when someone turns notifications off. */
export async function unsubscribePush(endpoint: unknown): Promise<SubscribeResult> {
  const parsed = z.string().url().max(1000).safeParse(endpoint);
  if (!parsed.success) return { ok: false, error: "Invalid subscription." };

  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false, error: "Notifications are not configured." };

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", parsed.data);

  if (error) {
    console.error("[push] unsubscribe failed:", error);
    return { ok: false, error: "Could not turn notifications off." };
  }
  return { ok: true };
}
