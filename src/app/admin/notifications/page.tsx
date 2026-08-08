import type { Metadata } from "next";
import { AlertCircle, Bell, Mail, Smartphone, Trash2 } from "lucide-react";
import { hasEmailRelay } from "@/lib/email";
import { hasPushConfig } from "@/lib/push";
import { listPushDevices, listRecipients } from "@/lib/recipients";
import { deleteRecipient, removePushDevice } from "./actions";
import { RecipientForm } from "./recipient-form";

export const metadata: Metadata = { title: "Notifications" };

function when(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

export default async function NotificationsPage() {
  const [recipients, devices] = await Promise.all([
    listRecipients(),
    listPushDevices(),
  ]);

  const activeForOrders = recipients.filter(
    (r) => r.is_active && r.on_new_order && r.email,
  );
  const staffDevices = devices.filter((d) => d.audience === "staff");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Notifications
        </h1>
        <p className="mt-1 text-sm text-muted">
          Who hears about orders, and from which devices.
        </p>
      </div>

      {/* The one thing worth shouting about: a new order nobody is told about. */}
      {activeForOrders.length === 0 ? (
        <p className="flex items-start gap-2 rounded-xl border border-nonveg/40 bg-nonveg/10 p-4 text-sm text-nonveg">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <strong>Nobody is being emailed about new orders.</strong> An order
            could arrive with no one told. Add an address below.
          </span>
        </p>
      ) : null}

      {!hasEmailRelay ? (
        <p className="flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Email is not configured — set{" "}
          <code className="mx-1 font-mono">APPS_SCRIPT_EMAIL_URL</code> and its
          secret. Nothing below will send until then.
        </p>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="flex items-center gap-2 font-semibold">
          <Mail className="size-4 text-primary" aria-hidden />
          Email recipients
        </h2>

        {recipients.length === 0 ? (
          <p className="mt-3 rounded-xl border border-border bg-surface p-6 text-center text-sm text-muted">
            No recipients yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {recipients.map((recipient) => (
              <li
                key={recipient.id}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {recipient.name}
                      {!recipient.is_active ? (
                        <span className="ml-2 rounded-full bg-surface-alt px-2 py-0.5 text-xs font-medium text-muted">
                          off
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {recipient.email}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {[
                        recipient.on_new_order && "new orders",
                        recipient.on_cancellation && "cancellations",
                        recipient.on_refund_owed && "refunds owed",
                      ]
                        .filter(Boolean)
                        .join(" · ") || "nothing selected"}
                    </p>
                  </div>

                  <form action={deleteRecipient}>
                    <input type="hidden" name="id" value={recipient.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-nonveg/50 hover:text-nonveg"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Remove
                    </button>
                  </form>
                </div>

                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium text-primary">
                    Edit
                  </summary>
                  <div className="mt-3 border-t border-border pt-4">
                    <RecipientForm recipient={recipient} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 rounded-xl border border-border bg-surface p-4">
          <h3 className="font-semibold">Add a recipient</h3>
          <div className="mt-3">
            <RecipientForm />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="flex items-center gap-2 font-semibold">
          <Smartphone className="size-4 text-primary" aria-hidden />
          Devices getting push
        </h2>
        <p className="mt-1 text-sm text-muted">
          Push is per device, not per person — a phone and a laptop are two
          entries. Turn it on from the{" "}
          <a href="/kitchen" className="font-medium text-primary hover:underline">
            kitchen screen
          </a>{" "}
          on each one.
        </p>

        {!hasPushConfig ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            Push is not configured — the VAPID keys are missing.
          </p>
        ) : staffDevices.length === 0 ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm">
            <Bell className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              No device is registered for new-order alerts yet. On an iPhone you
              must add the site to your Home Screen first — Safari cannot receive
              notifications from a normal tab.
            </span>
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {devices.map((device) => (
              <li
                key={device.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {device.audience === "staff" ? "Kitchen" : "Customer"}
                    <span className="ml-2 font-normal text-muted">
                      added {when(device.created_at)}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted" title={device.label ?? ""}>
                    {device.label ?? "Unknown device"}
                  </p>
                </div>
                <form action={removePushDevice}>
                  <input type="hidden" name="id" value={device.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-nonveg/50 hover:text-nonveg"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
