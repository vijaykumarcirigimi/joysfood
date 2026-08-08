import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { BUSINESS } from "@/lib/business";

/**
 * Shared shell for the four policy pages.
 *
 * A route group, so the URLs stay at the root (/privacy, /terms, …). Payment
 * gateways check these paths and customers expect them there — burying them
 * under /legal/ makes both jobs harder.
 */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-12">
        <article className="legal-prose">{children}</article>
        <p className="mt-12 border-t border-border pt-6 text-xs text-muted">
          Last updated {BUSINESS.policiesLastUpdated}.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
