import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Who gets told what.
 *
 * This replaces KITCHEN_EMAIL, a single address buried in an Apps Script
 * property that the owner could not change without a developer. The list is
 * per-event rather than one "notify me" flag, so somebody who only wants to
 * hear about refunds is not forced to take every new order too.
 */

export type Recipient = {
  id: string;
  name: string;
  email: string | null;
  on_new_order: boolean;
  on_cancellation: boolean;
  on_refund_owed: boolean;
  is_active: boolean;
  created_at: string;
};

export type RecipientEvent = "new_order" | "cancellation" | "refund_owed";

const COLUMN: Record<RecipientEvent, keyof Recipient> = {
  new_order: "on_new_order",
  cancellation: "on_cancellation",
  refund_owed: "on_refund_owed",
};

export async function listRecipients(): Promise<Recipient[]> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("notification_recipients")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[recipients] list failed:", error);
    return [];
  }
  return (data ?? []) as Recipient[];
}

/**
 * Addresses to alert for one event.
 *
 * Returns an empty array rather than throwing when nothing is configured: the
 * caller falls back to the Apps Script's own KITCHEN_EMAIL, so emptying this
 * list by accident makes the kitchen quieter, never silent.
 */
export async function emailsFor(event: RecipientEvent): Promise<string[]> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("notification_recipients")
    .select("email")
    .eq("is_active", true)
    .eq(COLUMN[event] as string, true)
    .not("email", "is", null);

  if (error) {
    console.error("[recipients] lookup failed:", error);
    return [];
  }

  return (data ?? [])
    .map((row) => (row as { email: string | null }).email)
    .filter((email): email is string => Boolean(email));
}

export type PushDevice = {
  id: string;
  audience: string;
  label: string | null;
  endpoint: string;
  created_at: string;
  last_used_at: string | null;
};

/** Registered devices, for the admin list. Endpoints are shown truncated. */
export async function listPushDevices(): Promise<PushDevice[]> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, audience, label, endpoint, created_at, last_used_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[recipients] devices failed:", error);
    return [];
  }
  return (data ?? []) as PushDevice[];
}
