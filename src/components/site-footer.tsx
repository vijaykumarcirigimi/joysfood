import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { BUSINESS } from "@/lib/business";

/**
 * Policy links live here rather than only at their URLs: payment gateways
 * check that Privacy, Terms, Refunds and Contact are reachable by clicking
 * from the homepage, and customers look in the footer for them.
 */
const FOOTER_GROUPS = [
  {
    heading: "Ordering",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/contact", label: "Contact us" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/terms", label: "Terms of Service" },
      { href: "/refunds", label: "Cancellation & Refunds" },
      { href: "/privacy", label: "Privacy Policy" },
    ],
  },
] as const;

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
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Cooked in a home kitchen. We cannot guarantee any dish is free of
            allergen traces — see our{" "}
            <Link
              href="/terms"
              className="font-medium text-primary hover:underline"
            >
              terms
            </Link>
            .
          </p>
        </div>

        <div className="text-sm text-muted">
          <p className="font-semibold text-text">Kitchen hours</p>
          <p className="mt-2">Lunch · 12:00 – 15:00</p>
          <p>Dinner · 19:00 – 22:30</p>
        </div>

        {FOOTER_GROUPS.map((group) => (
          <nav key={group.heading} aria-label={group.heading} className="text-sm">
            <p className="font-semibold text-text">{group.heading}</p>
            <ul className="mt-2 space-y-1.5">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-muted transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-border">
        <p className="mx-auto max-w-[1140px] px-4 py-4 text-xs text-muted">
          © {new Date().getFullYear()} {BUSINESS.legalName}. All prices in INR
          and inclusive of taxes.
        </p>
      </div>
    </footer>
  );
}
