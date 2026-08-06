import { BrandMark } from "@/components/brand-mark";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface-alt">
      <div className="mx-auto flex max-w-[1140px] flex-wrap items-start justify-between gap-8 px-4 py-10">
        <div className="max-w-sm">
          <BrandMark />
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Prices include taxes. Menu availability varies by day — the slot
            picker will show what&rsquo;s cookable on your chosen date.
          </p>
        </div>

        <div className="text-sm text-muted">
          <p className="font-semibold text-text">Kitchen hours</p>
          <p className="mt-2">Lunch · 12:00 – 15:00</p>
          <p>Dinner · 19:00 – 22:30</p>
        </div>
      </div>
    </footer>
  );
}
