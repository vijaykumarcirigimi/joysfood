"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { categoryEmoji } from "@/lib/category-meta";
import { cn } from "@/lib/utils";

type RailSection = { slug: string; name: string };

export function CategoryRail({ sections }: { sections: RailSection[] }) {
  const [activeSlug, setActiveSlug] = useState(sections[0]?.slug ?? "");
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  const syncEdges = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    setAtStart(rail.scrollLeft <= 4);
    setAtEnd(rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 4);
  }, []);

  useEffect(() => {
    syncEdges();
    window.addEventListener("resize", syncEdges);
    return () => window.removeEventListener("resize", syncEdges);
  }, [syncEdges]);

  // Highlight whichever section is currently under the sticky header.
  useEffect(() => {
    const targets = sections
      .map(({ slug }) => document.getElementById(`cat-${slug}`))
      .filter((el): el is HTMLElement => el !== null);

    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible[0]) {
          setActiveSlug(visible[0].target.id.replace(/^cat-/, ""));
        }
      },
      { rootMargin: "-160px 0px -60% 0px", threshold: 0 },
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [sections]);

  // Keep the active chip in view as the page scrolls.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail || !activeSlug) return;

    const chip = rail.querySelector<HTMLElement>(`[data-slug="${activeSlug}"]`);
    if (!chip) return;

    const chipLeft = chip.offsetLeft;
    const chipRight = chipLeft + chip.offsetWidth;
    if (chipLeft < rail.scrollLeft + 16 || chipRight > rail.scrollLeft + rail.clientWidth - 16) {
      rail.scrollTo({
        left: chipLeft - rail.clientWidth / 2 + chip.offsetWidth / 2,
        behavior: "smooth",
      });
    }
  }, [activeSlug]);

  const nudge = (direction: -1 | 1) => {
    railRef.current?.scrollBy({
      left: direction * Math.max(240, (railRef.current.clientWidth ?? 0) * 0.7),
      behavior: "smooth",
    });
  };

  return (
    <nav
      aria-label="Menu categories"
      className="sticky top-[68px] z-30 border-b border-border bg-bg/90 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-[1140px] items-center gap-2 px-4 py-4">
        <button
          type="button"
          onClick={() => nudge(-1)}
          disabled={atStart}
          aria-label="Scroll categories left"
          className="hidden size-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors enabled:hover:border-primary/40 enabled:hover:text-primary disabled:opacity-35 sm:flex"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </button>

        <div
          ref={railRef}
          onScroll={syncEdges}
          className="no-scrollbar flex min-w-0 flex-1 gap-2.5 overflow-x-auto"
        >
          {sections.map((section) => {
            const isActive = section.slug === activeSlug;
            return (
              <a
                key={section.slug}
                href={`#cat-${section.slug}`}
                data-slug={section.slug}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border bg-surface text-text hover:border-primary/40",
                )}
              >
                <span aria-hidden className="text-base leading-none">
                  {categoryEmoji(section.slug)}
                </span>
                {section.name}
              </a>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => nudge(1)}
          disabled={atEnd}
          aria-label="Scroll categories right"
          className="hidden size-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors enabled:hover:border-primary/40 enabled:hover:text-primary disabled:opacity-35 sm:flex"
        >
          <ArrowRight className="size-4" aria-hidden />
        </button>
      </div>
    </nav>
  );
}
