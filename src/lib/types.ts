export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
};

export type MenuItem = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  /** Integer paise. Never a float — see plan.md §4. */
  price_paise: number;
  image_url: string | null;
  is_veg: boolean;
  is_available: boolean;
  /** Hours of notice the kitchen needs; drives slot filtering in Phase 3. */
  prep_lead_time_hours: number;
  display_order: number;
};

/** A category with its items attached, ready to render. */
export type MenuSection = Category & { items: MenuItem[] };

/** Where the menu on screen actually came from — surfaced in the dev banner. */
export type MenuSource = "supabase" | "seed";

/** Why the seed menu is being served, so the banner can say something useful. */
export type SeedReason =
  /** No Supabase env vars set. */
  | "not-configured"
  /** Configured, but the query failed — tables missing, RLS, network. */
  | "unavailable"
  /** Configured and reachable, but there are no rows yet. */
  | "empty";

export type Menu = {
  sections: MenuSection[];
  source: MenuSource;
  seedReason: SeedReason | null;
};
