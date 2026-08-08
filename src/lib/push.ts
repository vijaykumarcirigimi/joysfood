import "server-only";

import webpush, { type PushSubscription } from "web-push";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Web Push delivery.
 *
 * Like email, sending must never break an order: every failure is logged and
 * swallowed, and callers do not await a result they can act on.
 *
 * Dead subscriptions are deleted rather than retried. A push service returns
 * 404 or 410 once a browser has been uninstalled, cleared or had permission
 * revoked, and that state is permanent — retrying it forever would eventually
 * mean every send waits on a queue of endpoints that will never accept again.
 */

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const SUBJECT = process.env.VAPID_SUBJECT ?? "";

export const hasPushConfig = Boolean(PUBLIC_KEY && PRIVATE_KEY && SUBJECT);

if (hasPushConfig) {
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
}

export type PushPayload = {
  title: string;
  body: string;
  /** Where clicking it should land. */
  url?: string;
  /** Same tag replaces an earlier notification rather than stacking. */
  tag?: string;
  /** Keeps it on screen until acknowledged — for anything the kitchen must see. */
  requireInteraction?: boolean;
};

type Row = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/** All staff devices. */
export function pushToStaff(payload: PushPayload): void {
  void deliver({ audience: "staff" }, payload).catch((error) =>
    console.error("[push] staff delivery failed:", error),
  );
}

/**
 * The devices watching one order — the signed-in owner's, plus any guest device
 * that subscribed against this specific order token.
 */
export function pushToCustomer(
  orderToken: string,
  userId: string | null,
  payload: PushPayload,
): void {
  void deliver({ audience: "customer", orderToken, userId }, payload).catch(
    (error) => console.error("[push] customer delivery failed:", error),
  );
}

async function deliver(
  target: {
    audience: "staff" | "customer";
    orderToken?: string;
    userId?: string | null;
  },
  payload: PushPayload,
): Promise<void> {
  if (!hasPushConfig) return;

  const supabase = createSupabaseAdminClient();
  if (!supabase) return;

  let query = supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("audience", target.audience);

  if (target.audience === "customer") {
    // Either device is legitimate for this order: the account that owns it, or
    // the browser that placed it as a guest.
    const clauses = [`order_token.eq.${target.orderToken}`];
    if (target.userId) clauses.push(`user_id.eq.${target.userId}`);
    query = query.or(clauses.join(","));
  }

  const { data, error } = await query;
  if (error) {
    console.error("[push] subscription lookup failed:", error);
    return;
  }

  const subscriptions = (data ?? []) as Row[];
  if (subscriptions.length === 0) return;

  const body = JSON.stringify(payload);
  const dead: string[] = [];
  let sent = 0;

  await Promise.all(
    subscriptions.map(async (row) => {
      const subscription: PushSubscription = {
        endpoint: row.endpoint,
        keys: { p256dh: row.p256dh, auth: row.auth },
      };

      try {
        await webpush.sendNotification(subscription, body, { TTL: 60 * 60 });
        sent += 1;
      } catch (cause) {
        const status = (cause as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          dead.push(row.id);
        } else {
          console.error("[push] send failed:", status, row.endpoint.slice(0, 48));
        }
      }
    }),
  );

  if (dead.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", dead);
    console.log(`[push] removed ${dead.length} dead subscription(s)`);
  }

  console.log(
    `[push] ${target.audience}: sent ${sent}/${subscriptions.length}`,
    payload.title,
  );
}
