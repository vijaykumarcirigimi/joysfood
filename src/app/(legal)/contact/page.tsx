import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS, addressLines } from "@/lib/business";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "How to reach Joy's Food — email, phone, kitchen address, support hours, and our grievance contact.",
};

export default function ContactPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-bold tracking-tight text-text">
        Contact Us
      </h1>
      <p>
        A real person reads everything that comes in. For anything about an
        order you have already placed, quote the order number from your
        confirmation page — it looks like <code>JF-2608-0001</code> and it lets
        us find you instantly.
      </p>

      <h2>Get in touch</h2>
      <dl>
        <dt>Email</dt>
        <dd>
          <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
        </dd>

        <dt>Phone</dt>
        <dd>
          <a href={`tel:${BUSINESS.phone.replace(/\s+/g, "")}`}>
            {BUSINESS.phone}
          </a>{" "}
          — best for anything urgent, such as a same-day order or a severe
          allergy question.
        </dd>

        <dt>Support hours</dt>
        <dd>{BUSINESS.supportHours}</dd>

        <dt>Kitchen address</dt>
        <dd>
          {addressLines().map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </dd>
      </dl>
      <p>
        Pickup orders are collected from the kitchen address above during your
        chosen slot. Please do not visit outside a slot you have booked — it is
        a working home kitchen rather than a shop counter.
      </p>

      <h2>How quickly we reply</h2>
      <p>
        We aim to answer email within one working day. If your slot is sooner
        than that, please call instead — email is not a reliable way to reach us
        about an order happening in the next few hours.
      </p>

      <h2>Complaints</h2>
      <p>
        Tell us what went wrong and what you would like us to do about it, and
        we will come back to you within three working days. Food quality issues
        are covered by our{" "}
        <Link href="/refunds">Cancellation &amp; Refund Policy</Link>, which
        asks you to report problems within 24 hours.
      </p>

      <h2>Grievance Officer</h2>
      <p>
        For unresolved complaints, or anything about how we handle your personal
        data:
      </p>
      <p>
        {BUSINESS.grievanceOfficer.name}
        <br />
        {BUSINESS.legalName}
        <br />
        <a href={`mailto:${BUSINESS.grievanceOfficer.email}`}>
          {BUSINESS.grievanceOfficer.email}
        </a>
        <br />
        {addressLines().slice(1).join(", ")}
      </p>
      <p>
        Data-related rights and how to exercise them are set out in our{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>Business details</h2>
      <dl>
        <dt>Registered name</dt>
        <dd>{BUSINESS.legalName}</dd>

        <dt>Trading as</dt>
        <dd>{BUSINESS.brandName}</dd>

        {BUSINESS.gstin ? (
          <>
            <dt>GSTIN</dt>
            <dd>{BUSINESS.gstin}</dd>
          </>
        ) : null}

        {BUSINESS.fssaiLicence ? (
          <>
            <dt>FSSAI licence</dt>
            <dd>{BUSINESS.fssaiLicence}</dd>
          </>
        ) : null}
      </dl>
    </>
  );
}
