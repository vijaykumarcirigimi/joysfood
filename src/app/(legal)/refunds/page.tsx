import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS, CANCELLATION_CUTOFF_HOURS } from "@/lib/business";

export const metadata: Metadata = {
  title: "Cancellation & Refund Policy",
  description:
    "When you can cancel a Joy's Food pre-order for a full refund, what happens after the kitchen has started preparing, and how refunds are paid back.",
};

export default function RefundsPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight text-text">
        Cancellation &amp; Refund Policy
      </h1>
      <p>
        Because every order is cooked for a specific slot rather than taken off
        a shelf, the point at which we start spending money on your order is the
        point at which a cancellation starts costing us. This policy is built
        around that single moment.
      </p>

      <h2>The short version</h2>
      <p>
        Cancel more than{" "}
        <strong>{CANCELLATION_CUTOFF_HOURS} hours before your slot starts</strong>{" "}
        and you get a full refund, no questions asked. After that, the shopping
        is done and prep has begun, so we cannot refund as a matter of course.
      </p>

      <h2>Cancelling before the cutoff</h2>
      <p>
        Up to {CANCELLATION_CUTOFF_HOURS} hours before your slot begins, you can
        cancel for <strong>100% refund</strong>. This is the same moment that
        ordering for that slot closes, which is not a coincidence — it is when
        we commit to buying ingredients for the orders we hold.
      </p>
      <p>
        <strong>How to cancel:</strong> open your order page — the link on your
        confirmation, or via <em>Your orders</em> if you are signed in — and use{" "}
        <strong>Cancel this order</strong>. The button disappears once the
        window closes. If you paid online, the refund is issued automatically at
        the same moment.
      </p>
      <p>
        If you cannot reach the page, email{" "}
        <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> or call{" "}
        {BUSINESS.phone}, quoting the order number shown on your confirmation
        page (it looks like <code>JF-2608-0001</code>).
      </p>

      <h2>Cancelling after the cutoff</h2>
      <p>
        Inside the {CANCELLATION_CUTOFF_HOURS}-hour window, ingredients have
        been bought and cooking may already have started, so{" "}
        <strong>refunds are not automatic</strong>. Contact us anyway — if we
        genuinely have not started, or the ingredients can be used for another
        order, we will refund what we reasonably can. That is a judgement we
        make in good faith, not an entitlement.
      </p>

      <h2>If we cancel</h2>
      <p>
        If we cancel your order for any reason — illness, a supplier failing, a
        slot we oversold, a power cut —{" "}
        <strong>you receive a full refund, always</strong>, regardless of how
        close to the slot it happens. We will call or message you rather than
        leaving you to discover it.
      </p>

      <h2>How refunds are paid</h2>
      <dl>
        <dt>Paying on pickup or delivery</dt>
        <dd>
          Nothing has been charged, so there is nothing to refund. Just tell us
          you are cancelling.
        </dd>

        <dt>UPI transferred in advance</dt>
        <dd>
          Refunded to the UPI ID the payment came from, normally within 3
          working days of us confirming the cancellation.
        </dd>

        <dt>Paid online at checkout</dt>
        <dd>
          Refunded to the original payment method through our payment gateway.
          We initiate it within 2 working days; your bank or card issuer then
          typically takes 5&ndash;7 working days to show it. We cannot refund to
          a different account than the one you paid from.
        </dd>
      </dl>

      <h2>If something is wrong with your food</h2>
      <p>
        Tell us the same day, and within 24 hours at the latest, with your order
        number and a photograph if the problem is visible. Missing items, the
        wrong dish, or food that arrived in poor condition will be refunded or
        replaced at your choice. Complaints about food already eaten in full, or
        raised days later, are difficult for us to act on fairly.
      </p>
      <p>
        Taste is subjective and we season food the way we cook it at home.
        Not enjoying a dish is not, by itself, grounds for a refund — though we
        do want to hear about it.
      </p>

      <h2>Not collecting your order</h2>
      <p>
        For pickup orders, if you do not arrive during your slot and we cannot
        reach you, the food is held for a reasonable time and then treated as
        completed. No refund is due. The same applies to a delivery where nobody
        is available at a correct address.
      </p>

      <h2>Unpaid orders that expire</h2>
      <p>
        If you choose to pay by advance UPI transfer, your slot is held for a
        short period while we wait for the money. If it does not arrive in that
        window the order is cancelled automatically and the seat is released to
        other customers. Nothing was charged, so no refund arises.
      </p>

      <h2>Disputes</h2>
      <p>
        Please contact us before raising a dispute with your bank or card
        issuer. A chargeback filed without talking to us first costs us a fee
        even when we were always willing to refund, and it takes far longer for
        you. If you are unhappy with our decision, our grievance contact is on
        the <Link href="/contact">Contact page</Link>.
      </p>

      <h2>Questions</h2>
      <p>
        <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> ·{" "}
        {BUSINESS.phone} · {BUSINESS.supportHours}. This policy forms part of
        our <Link href="/terms">Terms of Service</Link>.
      </p>
    </>
  );
}
