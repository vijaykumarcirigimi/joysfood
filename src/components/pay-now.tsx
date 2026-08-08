"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CreditCard, Loader2 } from "lucide-react";
import { confirmPayment, startPayment } from "@/app/actions/razorpay";
import { formatPaise } from "@/lib/utils";

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

type RazorpayResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayInstance = { open: () => void };

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

/** Loaded on click, not on page load — most views of this page never pay. */
function loadCheckoutScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CHECKOUT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(Boolean(window.Razorpay)));
      existing.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function PayNow({
  publicToken,
  amountPaise,
  autoOpen = false,
  testMode = false,
}: {
  publicToken: string;
  amountPaise: number;
  /** Set when checkout redirected here to pay immediately. */
  autoOpen?: boolean;
  testMode?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // Guards the auto-open against React's double-invoked effects in dev, which
  // would otherwise open two Checkout modals.
  const autoOpened = useRef(false);

  const pay = useCallback(async () => {
    setError(null);
    setDismissed(false);
    setBusy(true);

    const started = await startPayment(publicToken);
    if (!started.ok) {
      setError(started.error);
      setBusy(false);
      // An expired hold or an already-paid order means our view is stale.
      router.refresh();
      return;
    }

    const ready = await loadCheckoutScript();
    if (!ready || !window.Razorpay) {
      setError(
        "Couldn't load the payment window. Check your connection and try again.",
      );
      setBusy(false);
      return;
    }

    const checkout = new window.Razorpay({
      key: started.keyId,
      order_id: started.razorpayOrderId,
      amount: started.amountPaise,
      currency: "INR",
      name: "Joy's Food",
      description: `Order ${started.orderNumber}`,
      prefill: {
        name: started.customerName,
        contact: started.customerContact,
        ...(started.customerEmail ? { email: started.customerEmail } : {}),
      },
      notes: { order_number: started.orderNumber },
      theme: { color: "#e2571e" },

      handler: async (response: RazorpayResponse) => {
        const confirmed = await confirmPayment({
          publicToken,
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          signature: response.razorpay_signature,
        });

        if (!confirmed.ok) {
          // The money may well have left their account, so never imply it
          // did not. The webhook will still settle this order.
          setError(
            `${confirmed.error} If you were charged, don't pay again — we'll confirm it shortly.`,
          );
          setBusy(false);
          router.refresh();
          return;
        }

        router.refresh();
        setBusy(false);
      },

      modal: {
        ondismiss: () => {
          setBusy(false);
          setDismissed(true);
        },
      },
    });

    checkout.open();
  }, [publicToken, router]);

  useEffect(() => {
    if (!autoOpen || autoOpened.current) return;
    autoOpened.current = true;
    void pay();
  }, [autoOpen, pay]);

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary-soft p-5">
      <p className="font-semibold">Payment pending</p>
      <p className="mt-1 text-sm text-muted">
        Your slot is held while you pay. Complete the payment to confirm this
        order.
      </p>

      <button
        type="button"
        onClick={pay}
        disabled={busy}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-fg transition-colors enabled:hover:bg-primary-hover disabled:opacity-60"
      >
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Opening payment…
          </>
        ) : (
          <>
            <CreditCard className="size-4" aria-hidden />
            Pay {formatPaise(amountPaise)} now
          </>
        )}
      </button>

      {dismissed && !error ? (
        <p className="mt-3 text-sm text-muted">
          Payment window closed. Nothing has been charged — you can pay again
          above while the slot is still held.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 text-sm text-nonveg"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {testMode ? (
        <p className="mt-3 rounded-lg bg-accent/15 px-3 py-2 text-xs text-muted">
          <strong>Test mode.</strong> No real money moves. This banner disappears
          when live keys are in use.
        </p>
      ) : null}
    </div>
  );
}
