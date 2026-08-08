// Loads the real Joy's Food menu with PLACEHOLDER prices so the new nav can be
// seen, and archives the sample dishes.
//
// Prices here are invented round numbers, not quoted by the kitchen. They are
// deliberately not hidden behind is_available = false, because a menu rendered
// entirely as "Sold out today" cannot be reviewed — but that means they are
// live and orderable, and must be replaced before the URL is shared.
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const H = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};
const rest = async (p, o = {}) => {
  const r = await fetch(`${SB}/rest/v1/${p}`, { headers: H, ...o });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
};

const cats = Object.fromEntries(
  (await rest("categories?select=id,slug")).map((c) => [c.slug, c.id]),
);

// name, ₹, veg, notice hours, description
const MENU = {
  veg: [
    ["Veg Meals", 150, true, 12, "Pappu, Andhra veg curry, sweet, rasam, papad, curd, rice and pickle"],
    ["Andhra Pulihora", 120, true, 12, "Tamarind rice, tempered the Andhra way"],
  ],
  "non-veg": [
    ["Chicken Meals", 250, false, 12, "Pappu, chicken curry, egg, sweet, rasam, curd and rice"],
    ["Mutton Meals", 350, false, 24, "Pappu, mutton curry, egg, sweet, rasam, curd and rice"],
    ["Chicken Fry", 280, false, 12, "Dry-fried, thick with masala"],
    ["Mutton Fry", 400, false, 24, "Slow-fried until the masala clings"],
    ["Egg Curry", 140, false, 12, "Boiled eggs in a home-style gravy"],
    ["Tomato Egg Curry", 150, false, 12, "Tangy tomato base, eggs folded through"],
  ],
  snacks: [
    ["Mirchi Bajji", 60, true, 12, "Stuffed chillies in a gram-flour batter"],
    ["Masala Vada", 60, true, 12, "Crisp chana dal vada"],
    ["Aratikaya Bajji", 70, true, 12, "Raw banana fritters"],
  ],
  powders: [
    ["Rasam Powder", 180, true, 0, "Home-roasted and ground"],
    ["Chicken Masala", 200, false, 0, "Our own blend for chicken curry"],
    ["Garam Masala", 220, true, 0, "Whole spices, roasted and ground fresh"],
    ["Groundnut Powder", 160, true, 0, "Palli podi — good with rice and ghee"],
  ],
  desserts: [
    ["Pakam Gavvalu", 140, true, 12, "Shell-shaped sweets in sugar syrup"],
  ],
};

let inserted = 0;
for (const [slug, items] of Object.entries(MENU)) {
  const category_id = cats[slug];
  if (!category_id) throw new Error(`missing category: ${slug}`);

  for (const [i, [name, rupees, is_veg, prep, description]] of items.entries()) {
    const row = {
      category_id,
      name,
      description,
      price_paise: rupees * 100,
      is_veg,
      is_available: true,
      is_active: true,
      prep_lead_time_hours: prep,
      display_order: i + 1,
    };

    // Select-then-write rather than ON CONFLICT: menu_items has no unique
    // constraint on (category_id, name), so there is nothing for Postgres to
    // conflict against. Re-running this must not double the menu.
    const existing = await rest(
      `menu_items?category_id=eq.${category_id}&name=eq.${encodeURIComponent(name)}&select=id`,
    );

    if (existing.length > 0) {
      await rest(`menu_items?id=eq.${existing[0].id}`, {
        method: "PATCH",
        body: JSON.stringify(row),
      });
    } else {
      await rest("menu_items", { method: "POST", body: JSON.stringify(row) });
    }
    inserted += 1;
  }
}
console.log(`upserted ${inserted} dishes`);

// "Burri" is the same sweet as Boorelu. Renamed rather than replaced so the two
// order_items rows pointing at it keep resolving.
await rest("menu_items?name=eq.Burri", {
  method: "PATCH",
  body: JSON.stringify({
    name: "Boorelu",
    description: "Poornam boorelu — sweet lentil filling, fried",
    price_paise: 12000,
    is_veg: true,
    prep_lead_time_hours: 12,
    display_order: 0,
  }),
});
console.log("renamed Burri → Boorelu");

// Archive the sample dishes. is_active = false, never deleted: order_items
// reference them and the menu is a snapshot, not a live join.
const sampleSlugs = ["starters", "biryani-rice", "main-course", "breads", "beverages"];
const sampleIds = sampleSlugs.map((s) => cats[s]).filter(Boolean);
const archived = await rest(
  `menu_items?category_id=in.(${sampleIds.join(",")})&select=id`,
  { method: "PATCH", headers: { ...H, Prefer: "return=representation" },
    body: JSON.stringify({ is_active: false }) },
);
console.log(`archived ${archived.length} sample dishes`);

// Those categories now have no active dishes, so deactivate them too.
await rest(`categories?slug=in.(${sampleSlugs.join(",")})`, {
  method: "PATCH",
  body: JSON.stringify({ is_active: false }),
});
console.log("deactivated the sample categories");

const live = await rest(
  "menu_items?is_active=eq.true&select=name,price_paise,is_veg,prep_lead_time_hours,category:categories(slug,display_order)&order=name",
);
const byCat = {};
for (const item of live) {
  const key = item.category?.slug ?? "?";
  (byCat[key] = byCat[key] || []).push(`${item.name} ₹${item.price_paise / 100}`);
}
console.log("\nlive menu:");
for (const slug of ["veg", "non-veg", "snacks", "powders", "desserts"]) {
  if (byCat[slug]) console.log(`  ${slug}: ${byCat[slug].join(", ")}`);
}
const stray = Object.keys(byCat).filter((k) => !["veg","non-veg","snacks","powders","desserts"].includes(k));
if (stray.length) console.log("  STILL ACTIVE ELSEWHERE:", stray.join(", "));
console.log(`\ntotal active dishes: ${live.length}`);
