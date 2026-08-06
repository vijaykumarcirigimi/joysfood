import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function SectionHeader({
  title,
  description,
  viewAllHref,
}: {
  title: string;
  description?: string | null;
  viewAllHref?: string;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h2>
        <span className="mt-1.5 block h-[3px] w-11 rounded-full bg-primary" />
        {description ? (
          <p className="mt-2.5 text-sm text-muted">{description}</p>
        ) : null}
      </div>

      {viewAllHref ? (
        <Link
          href={viewAllHref}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text transition-colors hover:border-primary/40 hover:text-primary"
        >
          View all
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
