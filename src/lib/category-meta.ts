/**
 * Emoji shown on the category chips, keyed by slug. Unknown categories fall
 * back to a plate, so adding a category in admin never breaks the rail.
 */
const CATEGORY_EMOJI: Record<string, string> = {
  // The real Joy's Food categories.
  veg: "🥬",
  "non-veg": "🍗",
  snacks: "🧆",
  powders: "🧂",
  // Kept for the sample menu and anything added later in admin.
  starters: "🍢",
  "biryani-rice": "🍚",
  "main-course": "🍛",
  breads: "🫓",
  desserts: "🧁",
  beverages: "🥤",
  combos: "🍱",
  soups: "🍜",
  salads: "🥗",
  seafood: "🦐",
};

export function categoryEmoji(slug: string): string {
  return CATEGORY_EMOJI[slug] ?? "🍽️";
}
