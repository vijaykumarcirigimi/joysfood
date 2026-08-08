"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Bell, BellOff, Loader2 } from "lucide-react";
import {
  subscribeCustomer,
  subscribeStaff,
  unsubscribePush,
} from "@/app/actions/push";

/**
 * Turns browser notifications on for this device.
 *
 * Two things about Web Push that shape all of this:
 *
 *   1. It is per-device, not per-account. The kitchen's phone and the kitchen's
 *      laptop are two subscriptions and both must be registered separately.
 *
 *   2. On iOS it only works once the site has been added to the Home Screen
 *      (iOS 16.4+). Safari in a normal tab exposes no PushManager at all, which
 *      is why the unsupported branch below tells iPhone users what to do rather
 *      than just saying "not supported".
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

/**
 * VAPID keys travel as base64url; PushManager wants raw bytes.
 *
 * Returns ArrayBuffer rather than Uint8Array deliberately. TypeScript 5.7+
 * types Uint8Array as Uint8Array<ArrayBufferLike>, which is not assignable to
 * applicationServerKey's BufferSource because ArrayBufferLike admits
 * SharedArrayBuffer. Handing over the .buffer sidesteps the variance instead of
 * casting the error away.
 */
function urlBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalised);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

type State = "checking" | "unsupported" | "blocked" | "off" | "on";

export function PushToggle({
  audience,
  orderToken,
  className,
}: {
  audience: "staff" | "customer";
  /** Required for customers — a guest has no account to attach to. */
  orderToken?: string;
  className?: string;
}) {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // iOS only exposes push inside an installed PWA, so detect the combination
  // rather than blaming the browser.
  const [isIosBrowser, setIsIosBrowser] = useState(false);

  useEffect(() => {
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // Safari's own flag, still the only reliable signal on iOS.
      (window.navigator as { standalone?: boolean }).standalone === true;
    setIsIosBrowser(ios && !standalone);

    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !VAPID_PUBLIC_KEY
    ) {
      setState("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setState("blocked");
      return;
    }

    void (async () => {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const existing = await registration?.pushManager.getSubscription();
      setState(existing ? "on" : "off");
    })();
  }, []);

  const enable = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      // A worker that is installing cannot receive a subscription yet.
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(VAPID_PUBLIC_KEY),
      });

      const json = subscription.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };

      const payload = {
        endpoint: json.endpoint ?? "",
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        label: navigator.userAgent.slice(0, 80),
        ...(orderToken ? { orderToken } : {}),
      };

      const result =
        audience === "staff"
          ? await subscribeStaff(payload)
          : await subscribeCustomer(payload);

      if (!result.ok) {
        // Do not leave a live browser subscription we cannot deliver to.
        await subscription.unsubscribe();
        setError(result.error);
        setState("off");
        return;
      }

      setState("on");
    } catch (cause) {
      console.error("[push] enable failed:", cause);
      setError("Could not turn notifications on for this device.");
      setState("off");
    } finally {
      setBusy(false);
    }
  }, [audience, orderToken]);

  const disable = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await unsubscribePush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState("off");
    } catch (cause) {
      console.error("[push] disable failed:", cause);
      setError("Could not turn notifications off.");
    } finally {
      setBusy(false);
    }
  }, []);

  if (state === "checking") return null;

  if (state === "unsupported") {
    return (
      <p className={className}>
        <span className="flex items-start gap-2 text-sm text-muted">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {isIosBrowser ? (
            <>
              On iPhone, notifications only work once this site is installed.
              Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>,
              then open it from there and turn them on.
            </>
          ) : (
            <>This browser doesn&rsquo;t support notifications.</>
          )}
        </span>
      </p>
    );
  }

  if (state === "blocked") {
    return (
      <p className={className}>
        <span className="flex items-start gap-2 text-sm text-muted">
          <BellOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          Notifications are blocked for this site. Allow them in your browser
          settings, then reload.
        </span>
      </p>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={state === "on" ? disable : enable}
        disabled={busy}
        className={
          state === "on"
            ? "inline-flex items-center gap-2 rounded-xl border border-veg/40 bg-veg/10 px-4 py-2.5 text-sm font-semibold text-veg disabled:opacity-60"
            : "inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition-colors enabled:hover:bg-primary-hover disabled:opacity-60"
        }
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : state === "on" ? (
          <Bell className="size-4" aria-hidden />
        ) : (
          <BellOff className="size-4" aria-hidden />
        )}
        {state === "on"
          ? "Notifications on for this device"
          : audience === "staff"
            ? "Notify me of new orders"
            : "Notify me about this order"}
      </button>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-nonveg">
          {error}
        </p>
      ) : null}
    </div>
  );
}
