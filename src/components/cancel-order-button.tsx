"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { cancelOrder } from "@/app/actions/cancel-order";

/**
 * Customer-initiated cancellation.
 *
 * Two clicks on purpose: cancelling frees the slot to someone else and cannot
 * be undone, so a stray tap must not do it. The server re-checks the
 * cancellation window regardless of whether this button was rendered — this is
 * presentation, cancel_order() is the authority.
 */
export function CancelOrderButton({
  publicToken,
  wasPaid,
}: {
  publicToken: string;
  /** Changes the warning: money coming back reads differently from none. */
  wasPaid: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const outcome = await cancelOrder(publicToken, "customer");
      if (!outcome.ok) {
        setError(outcome.error);
        setConfirming(false);
        return;
      }
      setResult(outcome.message);
      setConfirming(false);
      router.refresh();
    });
  }

  if (result) {
    return (
      <p className="flex items-start gap-2 rounded-xl border border-border bg-surface-alt px-4 py-3 text-sm">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-veg" aria-hidden />
        {result}
      </p>
    );
  }

  return (
    <div>
      {confirming ? (
        <div className="rounded-xl border border-nonveg/40 bg-nonveg/5 p-4">
          <p className="text-sm font-semibold">Cancel this order?</p>
          <p className="mt-1 text-sm text-muted">
            Your slot goes back to other customers and this cannot be undone.
            {wasPaid
              ? " Your payment will be refunded — it usually reaches your account in 5–7 working days."
              : " Nothing has been charged."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirm}
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-xl bg-nonveg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <XCircle className="size-4" aria-hidden />
              )}
              Yes, cancel it
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              Keep my order
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-sm font-medium text-muted underline underline-offset-2 transition-colors hover:text-nonveg"
        >
          Cancel this order
        </button>
      )}

      {error ? (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 text-sm text-nonveg"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}
