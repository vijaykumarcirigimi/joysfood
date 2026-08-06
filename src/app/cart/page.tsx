import type { Metadata } from "next";
import { Checkout, type CatalogEntry } from "@/components/checkout";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getMenu } from "@/lib/menu";
import { getSlotAvailability } from "@/lib/slots";

export const metadata: Metadata = { title: "Your cart" };

// Seat counts change constantly — this page must never be cached.
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const [{ sections }, { days, configured }] = await Promise.all([
    getMenu(),
    getSlotAvailability(),
  ]);

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
        <Checkout days={days} catalog={catalog} slotsConfigured={configured} />
      </main>
      <SiteFooter />
    </div>
  );
}
