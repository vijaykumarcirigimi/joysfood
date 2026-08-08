// Deletes the orders the Playwright suite created, freeing their slot seats.
//
// Kept as a separate script rather than a global teardown so it can also be run
// by hand after an interrupted run: `node e2e/cleanup.mjs`.
import { readFileSync } from "node:fs";

const CUSTOMER = "Playwright Test";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);

const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const SRK = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SB || !SRK) {
  console.error("Missing Supabase config in .env.local");
  process.exit(1);
}

const headers = {
  apikey: SRK,
  Authorization: `Bearer ${SRK}`,
  "Content-Type": "application/json",
};

const found = await fetch(
  `${SB}/rest/v1/orders?customer_name=eq.${encodeURIComponent(CUSTOMER)}&select=id,order_number,payment_status`,
  { headers },
);
const orders = await found.json();

if (!Array.isArray(orders) || orders.length === 0) {
  console.log("nothing to clean up");
  process.exit(0);
}

// A paid test order is worth knowing about before it disappears.
const paid = orders.filter((o) => o.payment_status === "paid");
if (paid.length) {
  console.log(
    `note: deleting ${paid.length} PAID test order(s): ${paid.map((o) => o.order_number).join(", ")}`,
  );
}

for (const order of orders) {
  await fetch(`${SB}/rest/v1/order_items?order_id=eq.${order.id}`, {
    method: "DELETE",
    headers,
  });
  await fetch(`${SB}/rest/v1/orders?id=eq.${order.id}`, {
    method: "DELETE",
    headers,
  });
  console.log(`deleted ${order.order_number}`);
}

console.log(`cleaned up ${orders.length} test order(s)`);
