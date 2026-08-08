import type { Metadata } from "next";
import Link from "next/link";
import { BOOKING_WINDOW_DAYS } from "@/lib/slots";
import { BUSINESS, addressLines } from "@/lib/business";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms you agree to when you pre-order from Joy's Food: how slots and cutoffs work, pricing, payment, pickup and delivery, and allergen information.",
};

export default function TermsPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight text-text">
        Terms of Service
      </h1>
      <p>
        These terms govern your use of {BUSINESS.brandName} and any order you
        place through it. By placing an order you accept them. Please read the
        section on allergens.
      </p>

      <h2>Who you are dealing with</h2>
      <p>
        {BUSINESS.legalName}, a home kitchen operating as {BUSINESS.brandName}{" "}
        from {addressLines().join(", ")}.
        {BUSINESS.gstin ? ` GSTIN ${BUSINESS.gstin}.` : ""}
        {BUSINESS.fssaiLicence
          ? ` FSSAI licence ${BUSINESS.fssaiLicence}.`
          : ""}
      </p>

      <h2>How pre-ordering works</h2>
      <p>
        We are not a restaurant with food sitting ready. Every order is cooked
        for the slot you choose, which is why the rules below matter more than
        they would elsewhere.
      </p>
      <ul>
        <li>
          You can order up to <strong>{BOOKING_WINDOW_DAYS} days</strong> ahead.
        </li>
        <li>
          Each time slot holds a limited number of orders. When it is full, it
          is full — the slot picker will show it as unavailable.
        </li>
        <li>
          <strong>Ordering for a slot closes a set number of hours before it
          starts</strong>, so we can shop and prep. The slot picker shows you
          which slots are still open; ones past their cutoff cannot be selected.
        </li>
        <li>
          Some dishes need longer notice than others. If your cart contains a
          dish with a long preparation time, nearer slots will be unavailable
          until that notice period is satisfied.
        </li>
      </ul>

      <h2>Prices and taxes</h2>
      <p>
        All prices are in Indian Rupees and include applicable taxes. The price
        that applies is the one shown at the moment you place the order. Because
        the cart lives in your browser, a cart left open overnight is re-priced
        against the live menu at checkout — if a price has changed you will see
        it flagged before you pay.
      </p>

      <h2>When an order becomes binding</h2>
      <p>
        Your order is placed once you complete checkout and reach the
        confirmation page with an order number. We may still cancel it if we
        genuinely cannot fulfil it — an ingredient fails to arrive, the kitchen
        closes for illness, or a slot was oversold. If we cancel, you get a{" "}
        <strong>full refund</strong>, always. See the{" "}
        <Link href="/refunds">Cancellation &amp; Refund Policy</Link>.
      </p>

      <h2>Payment</h2>
      <p>Depending on what is enabled at the time, you may:</p>
      <ul>
        <li>
          <strong>Pay on pickup or delivery</strong>, in cash or by UPI when you
          collect.
        </li>
        <li>
          <strong>Transfer by UPI in advance</strong>, which we confirm manually
          before the order is treated as paid. Your order is held for a limited
          time while we wait for that transfer; if it does not arrive, the slot
          is released.
        </li>
        <li>
          <strong>Pay online at checkout</strong>, where that option is offered.
          Payment is handled by a licensed payment gateway. We never see your
          card number, UPI PIN or bank credentials.
        </li>
      </ul>

      <h2>Pickup and delivery</h2>
      <p>
        <strong>Pickup</strong> is from our kitchen at the address above, during
        the slot you selected. Please arrive within the slot — food held for
        hours after it was cooked is not the food we want to give you.
      </p>
      <p>
        <strong>Delivery</strong>, where offered, is to the address you give at
        checkout and within the slot you chose. We aim to arrive inside that
        window, but traffic and weather are outside our control, so the slot is
        a target rather than a guarantee. Please make sure someone can receive
        the order and that the phone number you gave is reachable. If we cannot
        reach you or nobody is available, we will wait a reasonable time and
        then treat the order as delivered — an incorrect or incomplete address
        is not grounds for a refund.
      </p>

      <h2>Food, allergens and safety</h2>
      <p>
        Food is cooked to order in a <strong>home kitchen</strong>, not a
        segregated commercial facility. Nuts, dairy, gluten, mustard, sesame and
        other common allergens are handled in the same space, and{" "}
        <strong>we cannot guarantee any dish is free of traces of them</strong>.
      </p>
      <p>
        You can leave an allergy or dietary note for the kitchen and we will do
        our best to honour it, but a note is not a guarantee.{" "}
        <strong>
          If you have a severe allergy, please call us before ordering rather
          than relying on the notes field.
        </strong>{" "}
        Vegetarian and non-vegetarian dishes are marked on the menu and prepared
        with separate utensils wherever practical.
      </p>
      <p>
        Our food is cooked fresh for your slot and is meant to be eaten soon
        after collection or delivery. Once it has left us we cannot control how
        it is stored or reheated.
      </p>

      <h2>Cancellations</h2>
      <p>
        Cancellation windows, refund methods and timelines are set out in the{" "}
        <Link href="/refunds">Cancellation &amp; Refund Policy</Link>, which
        forms part of these terms.
      </p>

      <h2>Using the site properly</h2>
      <p>
        Please do not place orders you do not intend to collect, use someone
        else&rsquo;s payment details, attempt to interfere with the site, or
        scrape it. We may refuse service or close an account where this happens,
        or where a customer is abusive to us.
      </p>

      <h2>Our responsibility to you</h2>
      <p>
        We take our food and your order seriously, and nothing here limits our
        liability for death or personal injury caused by our negligence, for
        fraud, or for anything else that cannot lawfully be limited. Subject to
        that, our liability for any order is limited to the amount you paid for
        it, and we are not liable for indirect or consequential losses.
      </p>
      <p>
        We may pause ordering or close slots at short notice — illness, a power
        cut, a supplier failing. Orders affected are cancelled and refunded in
        full.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of India, and the courts at{" "}
        {BUSINESS.address.city}, {BUSINESS.address.state} have exclusive
        jurisdiction over any dispute.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. The version that applies to your order is the
        one published when you placed it. The date at the foot of this page
        shows when it last changed.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms:{" "}
        <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> or{" "}
        {BUSINESS.phone}. Full details on our{" "}
        <Link href="/contact">Contact page</Link>.
      </p>
    </>
  );
}
