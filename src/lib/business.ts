/**
 * Business identity, in one place.
 *
 * The legal pages, the contact page and the footer all read from here, so
 * these details are written once and stay consistent. Razorpay's onboarding
 * team checks the address, phone and email on your live site against the
 * documents you submit — a mismatch is a common rejection reason.
 *
 * ⚠️ Any value still marked PLACEHOLDER renders verbatim on public pages.
 * Fill the remaining ones in before you deploy or submit KYC.
 */

const PLACEHOLDER = {
  email: "[you@example.com]",
  phone: "[+91 XXXXX XXXXX]",
  fssai: "[FSSAI licence number]",
} as const;

export const BUSINESS = {
  /** Customer-facing brand. */
  brandName: "Joy's Food",

  /** The entity that takes the money. Must match the bank account and PAN. */
  legalName: "Joys Food Kitchen",
  proprietor: "N Rama Prasanna",

  address: {
    street: "House No 9, 9th Cross, Shri Kalabiraveshwara Nilaya",
    landmark: "Near Garden Court Bar and Restaurant",
    area: "Yelachenahalli",
    city: "Bangalore",
    state: "Karnataka",
    pincode: "560078",
    country: "India",
  },

  email: PLACEHOLDER.email,
  phone: PLACEHOLDER.phone,

  /**
   * Not GST-registered — a home kitchen is well under the ~₹20 lakh services
   * threshold. Null means the GSTIN line is omitted everywhere rather than
   * rendered blank. Do not display or collect GST until this is a real number.
   */
  gstin: null as string | null,

  /** The business proof Razorpay will accept for a food business. */
  fssaiLicence: PLACEHOLDER.fssai as string | null,

  /**
   * Named contact for complaints. India's IT Rules 2021 and the DPDP Act 2023
   * both expect a reachable grievance contact, and Razorpay looks for one.
   * The proprietor, which is correct for a one-person kitchen.
   */
  grievanceOfficer: {
    name: "N Rama Prasanna",
    email: PLACEHOLDER.email,
  },

  supportHours: "10:00 – 21:00 IST, seven days a week",

  /** Bump whenever you edit a policy page. Shown to customers. */
  policiesLastUpdated: "8 August 2026",
} as const;

/**
 * Free-cancellation window, in hours before the slot starts.
 *
 * Deliberately equal to the default slot ordering cutoff
 * (`time_slots.cutoff_hours_before`, 12h). Past that moment the kitchen has
 * already shopped and begun prep for that slot, so the policy boundary and the
 * operational boundary are the same instant — which is what makes it defensible
 * to a customer and to a payment gateway reviewing a dispute.
 *
 * If you change the slot cutoff in the admin panel, change this too.
 */
export const CANCELLATION_CUTOFF_HOURS = 12;

/** Formatted postal address, one line per element. */
export function addressLines(): string[] {
  const a = BUSINESS.address;
  return [
    BUSINESS.legalName,
    a.street,
    a.landmark,
    a.area,
    `${a.city}, ${a.state} ${a.pincode}`,
    a.country,
  ];
}
