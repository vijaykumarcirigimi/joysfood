import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS, addressLines } from "@/lib/business";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What personal data Joy's Food collects when you pre-order, why we collect it, who we share it with, and how to have it corrected or deleted.",
};

export default function PrivacyPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight text-text">
        Privacy Policy
      </h1>
      <p>
        This policy explains what personal data {BUSINESS.brandName} collects
        when you browse the menu or place an order, why we collect it, and what
        control you have over it. It is written to meet India&rsquo;s Digital
        Personal Data Protection Act, 2023.
      </p>

      <h2>Who is responsible for your data</h2>
      <p>
        {BUSINESS.legalName}, operating as {BUSINESS.brandName}, is the data
        fiduciary for the information described here. You can reach us at{" "}
        <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> or{" "}
        {BUSINESS.phone}.
      </p>

      <h2>What we collect</h2>

      <h3>When you place an order</h3>
      <ul>
        <li>Your name and mobile number, so the kitchen can reach you.</li>
        <li>
          Your delivery address, only if you choose delivery rather than pickup.
        </li>
        <li>
          Any note you write for the kitchen, and the dishes, quantities,
          amounts, date and time slot of the order.
        </li>
      </ul>

      <h3>If you create an account</h3>
      <ul>
        <li>
          Your email address. If you sign in with Google, we also receive the
          name and profile photo on your Google account. We never receive your
          Google password.
        </li>
        <li>
          A record linking your past orders to your account, so you can see them
          on your orders page.
        </li>
      </ul>

      <h3>Automatically</h3>
      <ul>
        <li>
          A session cookie that keeps you signed in. It is strictly necessary —
          sign-in cannot work without it.
        </li>
        <li>
          Standard server logs kept by our hosting providers, which include IP
          addresses, for security and troubleshooting.
        </li>
      </ul>
      <p>
        Your shopping cart is stored in your own browser and is not sent to us
        until you place the order. We do <strong>not</strong> use advertising
        cookies, tracking pixels or third-party analytics.
      </p>

      <h2>Why we use it</h2>
      <ul>
        <li>
          <strong>To cook and hand over your order.</strong> This is the core
          purpose; without it we cannot fulfil a purchase you asked for.
        </li>
        <li>
          <strong>To contact you about that specific order</strong> — a delay, a
          sold-out dish, confirming a delivery address.
        </li>
        <li>
          <strong>To plan kitchen capacity</strong>, using aggregate counts of
          dishes per slot.
        </li>
        <li>
          <strong>To keep the accounting records</strong> that Indian tax law
          requires us to keep.
        </li>
      </ul>
      <p>
        We do not send marketing messages, and we do not sell, rent or trade
        your personal data to anyone.
      </p>

      <h2>Who else sees it</h2>
      <p>
        Only the service providers that make the site work, and only to the
        extent they need to:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> — hosts our database and runs the sign-in
          system. Your order records and account live here.
        </li>
        <li>
          <strong>Vercel</strong> — serves the website itself.
        </li>
        <li>
          <strong>Google</strong> — only if you choose to sign in with Google,
          and only to confirm your identity.
        </li>
        <li>
          <strong>Our payment gateway</strong> — when online payment is enabled,
          it processes your payment and receives the amount, your contact
          details and an order reference. We never see or store your card
          number, UPI PIN or bank credentials.
        </li>
      </ul>
      <p>
        We will also disclose data where the law compels us to, such as a valid
        order from a court or tax authority.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Order records are retained for as long as tax and accounting rules
        require us to keep our books — expect at least six years — after which
        they are deleted or stripped of anything identifying. If you close your
        account we delete your profile, but the underlying order records stay
        for that statutory period, because we are not permitted to erase
        financial records on request.
      </p>

      <h2>Your rights</h2>
      <p>Under the Digital Personal Data Protection Act, 2023, you may:</p>
      <ul>
        <li>Ask what personal data of yours we hold, and get a copy.</li>
        <li>Have inaccurate or incomplete details corrected.</li>
        <li>
          Ask us to erase data we no longer need for the purpose it was
          collected, subject to the retention rule above.
        </li>
        <li>
          Withdraw consent for anything you consented to. Withdrawing consent
          for us to hold your contact details means we can no longer take orders
          from your account.
        </li>
        <li>Nominate someone to exercise these rights if you cannot.</li>
      </ul>
      <p>
        Write to <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> with
        your request. We will respond within 30 days.
      </p>

      <h2>Keeping it safe</h2>
      <p>
        Traffic to this site is encrypted with HTTPS. Access to the order
        database is restricted by row-level security rules, so a signed-in
        customer can read their own orders and nobody else&rsquo;s. Kitchen and
        admin screens sit behind a separate password. No system is perfectly
        secure, and we will tell you and the Data Protection Board without undue
        delay if a breach affects your data.
      </p>

      <h2>Children</h2>
      <p>
        This site is not directed at children under 18, and we do not knowingly
        collect their data. If you believe a child has given us personal data,
        contact us and we will delete it.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes we will update the date at the foot of this page.
        Material changes will be announced on the site.
      </p>

      <h2>Grievances</h2>
      <p>
        If you are unhappy with how we have handled your data, contact our
        Grievance Officer:
      </p>
      <p>
        {BUSINESS.grievanceOfficer.name}
        <br />
        <a href={`mailto:${BUSINESS.grievanceOfficer.email}`}>
          {BUSINESS.grievanceOfficer.email}
        </a>
        <br />
        {addressLines().join(", ")}
      </p>
      <p>
        If we do not resolve it to your satisfaction, you may escalate to the
        Data Protection Board of India. See also our{" "}
        <Link href="/terms">Terms of Service</Link> and{" "}
        <Link href="/refunds">Cancellation &amp; Refund Policy</Link>.
      </p>
    </>
  );
}
