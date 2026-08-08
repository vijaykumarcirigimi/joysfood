import type { Metadata } from "next";
import { Checkout, type CatalogEntry } from "@/components/checkout";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { getMenu } from "@/lib/menu";
import { getSavedContact } from "@/lib/orders";
import { hasRazorpayConfig } from "@/lib/razorpay";
import { getSlotAvailability } from "@/lib/slots";
import { hasSupabaseConfig } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Your cart" };

// Seat counts change constantly — this page must never be cached.
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const [{ sections }, { days, configured }, user] = await Promise.all([
    getMenu(),
    getSlotAvailability(),
    getCurrentUser(),
  ]);

  // Only meaningful for a signed-in customer — RLS returns nothing for guests,
  // so there is no point paying for the round trip.
  const prefill = user ? await getSavedContact() : null;

  // Live prices and availability, so a cart left open overnight cannot check
  // out at yesterday's price or order something now sold out.
  const catalog: Record<string, CatalogEntry> = {};
  for (const section of sections) {
    for (const item of section.items) {
      catalog[item.id] = {
        name: item.name,
        pricePaise: item.price_paise,
        isAvailable: item.is_available,
        prepLeadHours: item.prep_lead_time_hours,
      };
    }
  }

  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-[1140px] px-4 py-10">
        <h1 className="mb-8 font-display text-3xl font-bold tracking-tight">
          Checkout
        </h1>
        <Checkout
          days={days}
          catalog={catalog}
          slotsConfigured={configured}
          signedInEmail={user?.email ?? null}
          prefill={prefill}
          authAvailable={hasSupabaseConfig}
          onlinePaymentAvailable={hasRazorpayConfig}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
