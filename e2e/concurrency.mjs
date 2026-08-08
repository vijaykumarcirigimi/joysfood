/**
 * plan.md:273 — "Full slots are genuinely unselectable, verified under two
 * simultaneous checkouts."
 *
 * place_order() takes pg_advisory_xact_lock on (slot, date) before reading
 * seats_taken, precisely so two customers cannot both read "1 seat left" and
 * both succeed. That lock has never been tested. This fires capacity + 10
 * orders at one empty slot simultaneously and asserts that exactly `capacity`
 * of them win.
 *
 * Calls the RPC directly rather than going through the app: the lock lives in
 * Postgres, and removing the HTTP/React layers makes the requests land closer
 * together, which is what actually stresses it.
 */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SRK = env.SUPABASE_SERVICE_ROLE_KEY;

const svc = { apikey: SRK, Authorization: `Bearer ${SRK}`, "Content-Type": "application/json" };
const anon = { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" };

const rest = async (p, o = {}) => {
  const r = await fetch(`${SB}/rest/v1/${p}`, { headers: svc, ...o });
  const t = await r.text();
  return t ? JSON.parse(t) : null;
};
const rpc = async (fn, args, headers = svc) => {
  const r = await fetch(`${SB}/rest/v1/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(args) });
  const t = await r.text();
  let b = null; try { b = JSON.parse(t); } catch {}
  return { status: r.status, body: Array.isArray(b) ? b[0] : b };
};

const pass = [], fail = [];
const ck = (n, ok, d = "") => (ok ? pass : fail).push(`${n}${d ? ` — ${d}` : ""}`);

const CUSTOMER = "Concurrency Test";

// A date far enough out that no real order touches it and the cutoff is clear.
const date = new Date(Date.now() + 11 * 86400000).toISOString().slice(0, 10);
const slot = (await rest("time_slots?select=id,label,max_orders&is_active=eq.true&order=display_order&limit=1"))[0];
const dish = (await rest("menu_items?select=id,name,price_paise&is_active=eq.true&is_available=eq.true&limit=1"))[0];

const capacity = (await rpc("slot_capacity", { p_slot_id: slot.id, p_date: date })).body;
const before = (await rpc("slot_seats_taken", { p_slot_id: slot.id, p_date: date })).body;

console.log(`slot     : ${slot.label}`);
console.log(`date     : ${date}`);
console.log(`capacity : ${capacity}   seats already taken: ${before}\n`);

if (before !== 0) {
  console.log("slot is not empty — pick another date");
  process.exit(1);
}

const ATTEMPTS = capacity + 10;
console.log(`firing ${ATTEMPTS} simultaneous orders at ${capacity} seats…\n`);

const order = (i) =>
  rpc("place_order", {
    p_customer_name: CUSTOMER,
    p_customer_phone: "9876543210",
    p_fulfilment_date: date,
    p_slot_id: slot.id,
    p_fulfilment_type: "pickup",
    p_payment_method: "cod",
    p_items: [{ menu_item_id: dish.id, quantity: 1 }],
  }, anon).then((r) => ({ i, ...r }));

const started = Date.now();
// Promise.all with no awaits between: all requests are in flight together.
const results = await Promise.all(Array.from({ length: ATTEMPTS }, (_, i) => order(i)));
const elapsed = Date.now() - started;

const ok = results.filter((r) => r.status === 200 && r.body?.order_number);
const rejected = results.filter((r) => !(r.status === 200 && r.body?.order_number));
const fullyBooked = rejected.filter((r) => /fully booked/i.test(r.body?.message ?? ""));
const other = rejected.filter((r) => !/fully booked/i.test(r.body?.message ?? ""));

console.log(`elapsed          : ${elapsed}ms`);
console.log(`succeeded        : ${ok.length}`);
console.log(`rejected         : ${rejected.length}  (fully booked: ${fullyBooked.length}, other: ${other.length})`);
if (other.length) {
  console.log("other rejection reasons:");
  [...new Set(other.map((r) => `${r.status} ${r.body?.message ?? JSON.stringify(r.body)}`))]
    .forEach((m) => console.log("   " + m.slice(0, 120)));
}
console.log();

ck("no oversell: successes === capacity", ok.length === capacity, `${ok.length} vs ${capacity}`);
ck("every rejection is 'fully booked'", other.length === 0, `${other.length} unexpected`);
ck("all attempts accounted for", ok.length + rejected.length === ATTEMPTS);

const after = (await rpc("slot_seats_taken", { p_slot_id: slot.id, p_date: date })).body;
ck("seats_taken matches capacity exactly", after === capacity, `${after} vs ${capacity}`);

// Order numbers must be unique — a duplicate would mean the sequence raced too.
const numbers = ok.map((r) => r.body.order_number);
ck("order numbers all unique", new Set(numbers).size === numbers.length,
   `${new Set(numbers).size} unique of ${numbers.length}`);

// And the slot must now refuse a fresh, non-concurrent order.
const late = await rpc("place_order", {
  p_customer_name: CUSTOMER, p_customer_phone: "9876543210",
  p_fulfilment_date: date, p_slot_id: slot.id, p_fulfilment_type: "pickup",
  p_payment_method: "cod", p_items: [{ menu_item_id: dish.id, quantity: 1 }],
}, anon);
ck("a later order is refused too", /fully booked/i.test(late.body?.message ?? ""), late.body?.message ?? "");

// ------------------------------------------------------------------ cleanup
const created = await rest(`orders?customer_name=eq.${encodeURIComponent(CUSTOMER)}&select=id`);
for (const o of created ?? []) {
  await rest(`order_items?order_id=eq.${o.id}`, { method: "DELETE" });
  await rest(`orders?id=eq.${o.id}`, { method: "DELETE" });
}
const left = await rest(`orders?customer_name=eq.${encodeURIComponent(CUSTOMER)}&select=id`);
ck("test orders cleaned up", (left ?? []).length === 0, `${(left ?? []).length} left`);

console.log("PASS:");
pass.forEach((p) => console.log("  ✓ " + p));
if (fail.length) { console.log("\nFAIL:"); fail.forEach((f) => console.log("  ✗ " + f)); }
console.log(`\n${pass.length} passed, ${fail.length} failed`);
process.exit(fail.length ? 1 : 0);
