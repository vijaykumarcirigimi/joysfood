import { cn } from "@/lib/utils";

/** Chef-hat mark + wordmark. "Joy's" in terracotta, "Food" in near-black. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 40 40"
        className="size-9 shrink-0"
        aria-hidden
        fill="none"
      >
        <path
          d="M11 18.5c-3 0-5-2.2-5-5s2.2-5 5-4.6C11.8 6.4 14.2 5 17 5c1.7 0 3.3.6 4.5 1.6A6.4 6.4 0 0 1 26 5c3 0 5.6 2 6.4 4.8 2.6.2 4.6 2.4 4.6 5s-2.2 5-5 5H11Z"
          fill="var(--primary)"
        />
        <rect
          x="11"
          y="18"
          width="21"
          height="4.5"
          rx="1.4"
          fill="var(--primary-hover)"
        />
        <circle cx="17.5" cy="27.5" r="1.6" fill="var(--text)" />
        <circle cx="26.5" cy="27.5" r="1.6" fill="var(--text)" />
        <path
          d="M19 32.5c1.2 1 3.2 1 4.4 0"
          stroke="var(--text)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M13.5 26.5c-1.2.3-2 1.3-2 2.5M30.5 26.5c1.2.3 2 1.3 2 2.5"
          stroke="var(--primary)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      <span className="font-display text-2xl leading-none font-semibold tracking-tight">
        <span className="text-primary">Joy&rsquo;s</span>{" "}
        <span className="text-text">Food</span>
      </span>
    </span>
  );
}
