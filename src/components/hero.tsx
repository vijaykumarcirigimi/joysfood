import Image from "next/image";
import { ArrowRight, CalendarDays, Play } from "lucide-react";
import { resolveHeroPhoto } from "@/lib/dish-photos";

/** Hand-drawn heart + swoosh that trails the headline in the reference. */
function HeartDoodle() {
  return (
    <svg
      viewBox="0 0 96 60"
      className="pointer-events-none absolute -top-6 -right-14 hidden h-14 w-24 sm:block"
      aria-hidden
      fill="none"
    >
      <path
        d="M18 26c-5-7 1-15 7-11 2-6 11-5 11 2 0 7-9 13-11 15-1.5-1.4-4.5-3.6-7-6Z"
        stroke="var(--primary)"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M40 40c14 10 34 8 46-6-9 1-14 4-16 9 8 3 15 1 20-4"
        stroke="var(--primary)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Decorative plating used until a real hero photo exists.
 * Drop `public/hero.jpg` (or .png/.webp) in and it is used instead.
 */
function HeroArtwork() {
  const plates = [
    { emoji: "🍛", className: "left-[6%] top-[16%] size-40 sm:size-48", z: "z-20" },
    { emoji: "🍚", className: "right-[8%] top-[6%] size-28 sm:size-32", z: "z-10" },
    { emoji: "🍢", className: "right-[4%] bottom-[8%] size-36 sm:size-44", z: "z-20" },
    { emoji: "🥗", className: "left-[22%] bottom-[4%] size-24 sm:size-28", z: "z-10" },
  ];

  return (
    <div className="relative h-64 w-full sm:h-80 lg:h-[22rem]">
      <div className="hero-blob absolute inset-x-4 inset-y-2 bg-[#f7e3cb]/70 dark:bg-white/5" />
      {plates.map((plate) => (
        <div
          key={plate.emoji}
          className={`absolute ${plate.className} ${plate.z} flex items-center justify-center rounded-full bg-surface shadow-float`}
        >
          <span className="text-5xl sm:text-6xl">{plate.emoji}</span>
        </div>
      ))}
      <span className="absolute top-[52%] left-[2%] size-2 rounded-full bg-veg/60" />
      <span className="absolute top-[12%] left-[46%] size-1.5 rounded-full bg-primary/50" />
      <span className="absolute right-[38%] bottom-[22%] size-2 rounded-full bg-accent/60" />
    </div>
  );
}

export function Hero() {
  const heroPhoto = resolveHeroPhoto();

  return (
    <section className="mx-auto max-w-[1140px] px-4 pt-5">
      <div className="overflow-hidden rounded-3xl bg-surface-alt">
        <div className="grid items-center gap-6 lg:grid-cols-[1fr_1.05fr]">
          <div className="px-6 py-8 sm:px-10 sm:py-12">
            <h1 className="relative inline-block font-display text-4xl leading-[1.08] font-bold tracking-tight text-balance sm:text-5xl">
              Delicious food,
              <br />
              <span className="text-primary">delivered to you</span>
              <HeartDoodle />
            </h1>

            <p className="mt-5 max-w-md leading-relaxed text-muted">
              Nothing sits under a heat lamp here. Pick your dishes, choose the
              day and time you want them, and we start cooking to hit that slot.
            </p>

            <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-surface px-4 py-2.5 text-sm font-medium text-primary">
              <CalendarDays className="size-4" aria-hidden />
              Pre-order up to 14 days ahead
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href="#menu"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-fg shadow-card transition-colors hover:bg-primary-hover"
              >
                Order Now
                <ArrowRight className="size-4" aria-hidden />
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 rounded-xl border border-border-strong bg-surface px-6 py-3.5 text-sm font-semibold text-text transition-colors hover:border-primary/40"
              >
                How It Works
                <Play className="size-4 fill-current" aria-hidden />
              </a>
            </div>
          </div>

          {heroPhoto ? (
            <div className="relative h-64 w-full sm:h-80 lg:h-[22rem]">
              <Image
                src={heroPhoto}
                alt="A spread of freshly cooked dishes"
                fill
                priority
                sizes="(min-width: 1024px) 560px, 100vw"
                className="object-cover"
              />
            </div>
          ) : (
            <HeroArtwork />
          )}
        </div>
      </div>
    </section>
  );
}
