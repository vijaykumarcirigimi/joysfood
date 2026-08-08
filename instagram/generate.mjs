/**
 * Renders Instagram posts as real PNGs from the live menu.
 *
 *   npm run instagram              a week of posts, no prices
 *   npm run instagram -- --prices  include prices (only once they are real)
 *
 * 1080×1350 portrait, which Instagram gives more feed height than a square.
 *
 * Design constraint worth naming: there are no dish photographs, so these lean
 * on type, colour and the category emoji instead of pretending otherwise. They
 * are good-looking cards, not food photography — a real photo of the actual
 * biryani will outperform any of them, and should replace them dish by dish.
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

const OUT = "instagram/out";
const W = 1080;
const H = 1350;
const SHOW_PRICES = process.argv.includes("--prices");

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

/**
 * The public domain, never NEXT_PUBLIC_SITE_URL on its own.
 *
 * That variable is http://localhost:3000 in .env.local, which is correct for
 * development and catastrophic here — the first render printed "localhost:3000"
 * onto an image meant for a public feed. Any localhost value is discarded.
 */
const PRODUCTION_SITE = "joysfood.vercel.app";
const configured = (env.NEXT_PUBLIC_SITE_URL || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
const SITE = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(configured) || !configured
  ? PRODUCTION_SITE
  : configured;

// ---------------------------------------------------------------- menu data
async function loadMenu() {
  const res = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/menu_items` +
      `?select=name,description,price_paise,is_veg,prep_lead_time_hours,category:categories(name,slug,display_order)` +
      `&is_active=eq.true&is_available=eq.true`,
    {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  );
  if (!res.ok) throw new Error(`menu fetch failed: ${res.status}`);
  const rows = await res.json();
  return rows
    .filter((r) => r.category)
    .sort((a, b) => (a.category.display_order ?? 99) - (b.category.display_order ?? 99));
}

const EMOJI = { veg: "🥬", "non-veg": "🍗", snacks: "🧆", powders: "🧂", desserts: "🧁" };
const rupees = (paise) => `₹${Math.round(paise / 100)}`;

// ------------------------------------------------------------------- shell
/**
 * Header pinned top, footer pinned bottom, content centred in what is left.
 *
 * The first version let content stack from the top with the footer pushed down
 * by margin-top:auto, which on a 1350px canvas left a third of the frame empty
 * under short posts — it read as unfinished rather than airy.
 */
function page(body, { bg = "#fffdfb", ink = "#221c15" } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${W}px;height:${H}px;overflow:hidden}
  body{background:${bg};color:${ink};
    font-family:"Plus Jakarta Sans",system-ui,sans-serif;
    display:flex;flex-direction:column;padding:76px 72px}
  main{flex:1;display:flex;flex-direction:column;justify-content:center;min-height:0}
  .display{font-family:"Fraunces",Georgia,serif;font-weight:700;line-height:1.02;letter-spacing:-.02em}
  .brand{display:flex;align-items:center;gap:14px;font-family:"Fraunces",Georgia,serif;
    font-weight:700;font-size:40px;color:#e2571e}
  .brand span.mark{font-size:44px}
  .foot{margin-top:auto;display:flex;align-items:flex-end;justify-content:space-between;gap:24px}
  .cta{font-size:30px;font-weight:700;color:#e2571e}
  .sub{font-size:26px;color:#7c7268;line-height:1.45}
  .pill{display:inline-flex;align-items:center;gap:12px;border-radius:999px;
    padding:14px 28px;font-size:26px;font-weight:600}
  .veg{width:26px;height:26px;border:3px solid #2e7d32;border-radius:5px;position:relative;flex:none}
  .veg::after{content:"";position:absolute;inset:5px;border-radius:50%;background:#2e7d32}
  .nonveg{width:26px;height:26px;border:3px solid #c62828;border-radius:5px;position:relative;flex:none}
  .nonveg::after{content:"";position:absolute;inset:5px;border-radius:50%;background:#c62828}
</style></head><body>${body}</body></html>`;
}

const header = `<div class="brand"><span class="mark">🍲</span>Joy&rsquo;s Food</div>`;
const footer = (line = "Pre-order at") =>
  `<div class="foot"><div><div class="sub" style="font-size:23px">${line}</div>
   <div class="cta">${SITE}</div></div>
   <div class="sub" style="font-size:22px;text-align:right">Cooked to order<br>in a home kitchen</div></div>`;

// ---------------------------------------------------------------- templates
function dishSpotlight(dish) {
  const cat = dish.category;
  const notice =
    dish.prep_lead_time_hours >= 24
      ? `${Math.round(dish.prep_lead_time_hours / 24)} day notice`
      : dish.prep_lead_time_hours > 0
        ? `${dish.prep_lead_time_hours}h notice`
        : "Ready to collect";

  return page(`
    ${header}<main>
    <div style="display:flex;align-items:center;gap:20px">
      <span class="pill" style="background:#fdf0e2;color:#e2571e">${EMOJI[cat.slug] ?? "🍽️"} ${cat.name}</span>
      <span class="${dish.is_veg ? "veg" : "nonveg"}"></span>
    </div>
    <div style="font-size:300px;line-height:1;margin:48px 0 8px">${EMOJI[cat.slug] ?? "🍽️"}</div>
    <h1 class="display" style="font-size:${dish.name.length > 16 ? 96 : 118}px;margin-top:24px">${dish.name}</h1>
    ${dish.description ? `<p class="sub" style="margin-top:28px;max-width:820px">${dish.description}</p>` : ""}
    <div style="margin-top:36px;display:flex;align-items:center;gap:20px">
      ${SHOW_PRICES ? `<span class="display" style="font-size:76px;color:#e2571e">${rupees(dish.price_paise)}</span>` : ""}
      <span class="pill" style="background:#fff;border:3px solid #f1e8dd;color:#7c7268;font-size:24px">🕐 ${notice}</span>
    </div>
    </main>${footer()}
  `);
}

function categoryBoard(name, slug, dishes) {
  return page(`
    ${header}<main>
    <div style="font-size:180px;line-height:1">${EMOJI[slug] ?? "🍽️"}</div>
    <h1 class="display" style="font-size:132px;margin-top:16px">${name}</h1>
    <div style="margin-top:56px;display:flex;flex-direction:column;gap:34px">
      ${dishes
        .slice(0, 5)
        .map(
          (d) => `<div style="display:flex;align-items:baseline;gap:20px">
            <span class="${d.is_veg ? "veg" : "nonveg"}" style="align-self:center"></span>
            <span class="display" style="font-size:58px;font-weight:600">${d.name}</span>
            ${SHOW_PRICES ? `<span class="sub" style="margin-left:auto;font-size:44px;color:#e2571e;font-weight:700">${rupees(d.price_paise)}</span>` : ""}
          </div>`,
        )
        .join("")}
    </div>
    </main>${footer("Full menu at")}
  `);
}

function howItWorks() {
  const steps = [
    ["1", "Pick your dishes", "Browse the menu, add what you want"],
    ["2", "Choose a day and slot", "Any day in the next two weeks"],
    ["3", "We cook it for that time", "Nothing reheated, nothing sitting"],
  ];
  return page(
    `
    ${header}<main>
    <h1 class="display" style="font-size:118px">How it<br>works</h1>
    <div style="margin-top:64px;display:flex;flex-direction:column;gap:44px">
      ${steps
        .map(
          ([n, title, body]) => `<div style="display:flex;gap:28px;align-items:flex-start">
            <div style="width:78px;height:78px;flex:none;border-radius:50%;background:#e2571e;color:#fff;
              display:flex;align-items:center;justify-content:center;font-size:42px;font-weight:700">${n}</div>
            <div><div class="display" style="font-size:54px;font-weight:600">${title}</div>
            <div class="sub" style="margin-top:8px">${body}</div></div>
          </div>`,
        )
        .join("")}
    </div>
    </main>${footer()}
  `,
  );
}

function cutoffReminder() {
  return page(
    `
    ${header}<main>
    <div style="font-size:200px;line-height:1">🕐</div>
    <h1 class="display" style="font-size:112px;margin-top:32px;color:#e2571e">Order tonight,<br>eat tomorrow</h1>
    <p class="sub" style="margin-top:36px;font-size:34px;max-width:840px">
      Every dish is cooked for the slot you choose — so ordering closes
      <strong style="color:#221c15">12 hours before</strong> it starts.
      Tomorrow&rsquo;s lunch is yours if you order by this evening.
    </p>
    </main>${footer()}
  `,
    { bg: "#fdf0e2" },
  );
}

function podiPost(dishes) {
  return page(
    `
    ${header}<main>
    <div style="font-size:190px;line-height:1">🧂</div>
    <h1 class="display" style="font-size:120px;margin-top:20px">Home-ground<br>podis</h1>
    <p class="sub" style="margin-top:32px;font-size:32px;max-width:860px">
      Roasted and ground in our kitchen, not bought in. Keeps for weeks.
    </p>
    <div style="margin-top:48px;display:flex;flex-wrap:wrap;gap:20px">
      ${dishes
        .map(
          (d) =>
            `<span class="pill" style="background:#fff;border:3px solid #e6d8c7;font-size:30px">${d.name}${SHOW_PRICES ? ` · ${rupees(d.price_paise)}` : ""}</span>`,
        )
        .join("")}
    </div>
    </main>${footer("Order at")}
  `,
  );
}

function homeKitchen() {
  return page(
    `
    ${header}<main>
    <h1 class="display" style="font-size:126px">Nothing<br>sits under<br>a heat lamp</h1>
    <p class="sub" style="margin-top:44px;font-size:34px;max-width:840px">
      We are one kitchen cooking to order. You choose the day and the time,
      and we start cooking to hit that slot.
    </p>
    <div style="margin-top:48px;display:flex;gap:16px;flex-wrap:wrap">
      ${["Andhra meals", "Snacks", "Podis", "Sweets"]
        .map((t) => `<span class="pill" style="background:#fdf0e2;color:#e2571e;font-size:28px">${t}</span>`)
        .join("")}
    </div>
    </main>${footer()}
  `,
  );
}

// ------------------------------------------------------------------- build
const menu = await loadMenu();
if (menu.length === 0) throw new Error("no active dishes — nothing to post");

const byCat = new Map();
for (const dish of menu) {
  const key = dish.category.slug;
  if (!byCat.has(key)) byCat.set(key, { name: dish.category.name, slug: key, dishes: [] });
  byCat.get(key).dishes.push(dish);
}

/** Spread spotlights across categories so a week is not seven curries. */
function pickSpotlights(count) {
  const pools = [...byCat.values()].map((c) => [...c.dishes]);
  const out = [];
  let i = 0;
  while (out.length < count && pools.some((p) => p.length)) {
    const pool = pools[i % pools.length];
    if (pool.length) out.push(pool.shift());
    i += 1;
  }
  return out;
}

const posts = [
  { name: "01-welcome", html: homeKitchen(), caption:
    "Cooked to order, in a home kitchen. You pick the day and the time slot — we start cooking to hit it. Nothing sits under a heat lamp.\n\nPre-order at " + SITE },
  { name: "02-how-it-works", html: howItWorks(), caption:
    "How it works, in three steps. Pick your dishes, choose a day and slot in the next two weeks, and we cook it for that time.\n\nPre-order at " + SITE },
  ...pickSpotlights(4).map((dish, i) => ({
    name: `0${i + 3}-${dish.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    html: dishSpotlight(dish),
    caption:
      `${dish.name}${dish.description ? ` — ${dish.description.toLowerCase()}` : ""}.` +
      `${dish.prep_lead_time_hours >= 24 ? " Needs a day's notice, so order ahead." : ""}` +
      `\n\nPre-order at ${SITE}`,
  })),
  { name: "07-cutoff", html: cutoffReminder(), caption:
    "Ordering for a slot closes 12 hours before it starts — that's when we go and buy the ingredients for it. Order tonight and tomorrow's lunch is yours.\n\n" + SITE },
];

const powders = byCat.get("powders");
if (powders) {
  posts.push({ name: "08-podis", html: podiPost(powders.dishes), caption:
    "Home-ground podis — roasted and ground in our kitchen, not bought in. Keeps for weeks.\n\nOrder at " + SITE });
}
for (const [slug, cat] of byCat) {
  if (cat.dishes.length >= 2) {
    posts.push({
      name: `09-${slug}-board`,
      html: categoryBoard(cat.name, slug, cat.dishes),
      caption: `Our ${cat.name.toLowerCase()}. Pre-order any day in the next two weeks.\n\n${SITE}`,
    });
  }
}

const HASHTAGS =
  "#joysfood #bangalorefood #andhrafood #homecooked #homekitchen #preorder " +
  "#bangalorefoodie #southindianfood #yelachenahalli #jayanagar #tiffin #podi";

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page_ = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });

const captions = [];
for (const post of posts) {
  await page_.setContent(post.html, { waitUntil: "load" });
  // Without this the display font falls back to Georgia on the first render.
  await page_.evaluate(() => document.fonts.ready);
  await page_.waitForTimeout(350);
  await page_.screenshot({ path: `${OUT}/${post.name}.png` });
  captions.push(`## ${post.name}.png\n\n${post.caption}\n\n${HASHTAGS}\n`);
  console.log(`  ${OUT}/${post.name}.png`);
}
await browser.close();

writeFileSync(
  `${OUT}/captions.md`,
  `# Captions\n\nOne post per day, in this order. ` +
    `${SHOW_PRICES ? "" : "Prices are deliberately left off the images — see the note in generate.mjs.\n"}` +
    `\n${captions.join("\n")}`,
);
console.log(`\n  ${OUT}/captions.md`);
console.log(`\n${posts.length} posts at ${W}×${H} @2x${SHOW_PRICES ? " with prices" : " (no prices)"}`);
