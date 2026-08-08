/**
 * Visible walkthrough of the ordering flow. Not a test — a demo.
 *
 *   npm run walkthrough
 *
 * Opens a real browser window, moves slowly enough to follow, screenshots every
 * step into test-results/walkthrough/, and DELIBERATELY LEAVES THE ORDERS IN
 * PLACE so they can be inspected in the app, the kitchen dashboard and the
 * Razorpay dashboard afterwards. Run `npm run test:e2e:clean` when done.
 *
 * Deliberately kept out of the Playwright suite: it creates orders nobody
 * cleans up, and it drives Razorpay's third-party modal, which is inherently
 * less stable than anything we own.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const SHOTS = "test-results/walkthrough";
mkdirSync(SHOTS, { recursive: true });

const CUSTOMER = "Playwright Test";
const HOLD_MS = Number(process.env.HOLD_MS ?? 90_000);

let step = 0;
const shot = async (page, name) => {
  step += 1;
  const file = `${SHOTS}/${String(step).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: file, fullPage: false });
  console.log(`   📷 ${file}`);
};

const log = (msg) => console.log(msg);

const browser = await chromium.launch({ headless: false, slowMo: 450 });
const page = await browser.newPage({
  viewport: { width: 1280, height: 900 },
  timezoneId: "Asia/Kolkata",
  locale: "en-IN",
});

async function addDish() {
  await page.goto("http://localhost:3000/");
  const card = page
    .locator("article")
    .filter({ has: page.getByRole("button", { name: "Add" }) })
    .first();
  const name = (await card.locator("h3").innerText()).trim();
  const price = (await card.locator("p.font-semibold").first().innerText()).trim();
  await card.getByRole("button", { name: "Add" }).click();
  return { name, price };
}

async function pickSlot() {
  const dates = page.getByTestId("date-option");
  for (let i = 0; i < (await dates.count()); i += 1) {
    await dates.nth(i).click();
    const slot = page
      .locator('[data-testid="slot-option"]:not([disabled])')
      .filter({ hasText: /\d+ left/ })
      .first();
    if (await slot.count()) {
      const label = (await slot.innerText()).replace(/\s+/g, " ").trim();
      await slot.click();
      return label;
    }
  }
  throw new Error("no bookable slot in the next 14 days");
}

// ===========================================================================
log("\n━━━ PART 1 — pay on delivery (completes fully) ━━━\n");
// ===========================================================================
const dish1 = await addDish();
log(`1. added "${dish1.name}" ${dish1.price} from the menu`);
await shot(page, "menu-dish-added");

await page.goto("http://localhost:3000/cart");
log("2. opened the cart");
await shot(page, "cart-with-item");

const slot1 = await pickSlot();
log(`3. picked slot: ${slot1}`);

await page.getByLabel("Name", { exact: true }).fill(CUSTOMER);
await page.getByLabel("Mobile number").fill("9876543210");
await page.getByRole("button", { name: "Pay on pickup / delivery" }).click();
log("4. filled details, chose pay-on-delivery");
await shot(page, "cart-ready-cod");

await page.getByRole("button", { name: /Place order/ }).click();
await page.waitForURL(/\/order\/[0-9a-f-]{36}/);
const codHeading = await page.getByRole("heading", { level: 1 }).innerText();
const codNumber = await page.getByText(/^JF-\d{4}-\d{4}$/).innerText();
const codUrl = page.url();
log(`5. order placed → "${codHeading}"  ${codNumber}`);
await shot(page, "order-confirmed-cod");

// ===========================================================================
log("\n━━━ PART 2 — pay online with Razorpay test mode ━━━\n");
// ===========================================================================
const dish2 = await addDish();
log(`6. added "${dish2.name}" ${dish2.price}`);
await page.goto("http://localhost:3000/cart");
const slot2 = await pickSlot();
await page.getByLabel("Name", { exact: true }).fill(CUSTOMER);
await page.getByLabel("Mobile number").fill("9876543210");
log(`7. picked slot: ${slot2}, kept "Pay online" (the default)`);
await shot(page, "cart-ready-online");

await page.getByRole("button", { name: /Place order/ }).click();
await page.waitForURL(/\?pay=1/);
const payUrl = page.url();
const rzpNumber = await page.getByText(/^JF-\d{4}-\d{4}$/).innerText();
log(`8. order held as pending_payment → ${rzpNumber}`);
log(`   ${payUrl}`);
await shot(page, "order-awaiting-payment");

log("9. waiting for Razorpay Checkout to open…");
await page
  .locator('iframe.razorpay-checkout-frame, iframe[src*="razorpay"]')
  .first()
  .waitFor({ state: "attached", timeout: 30_000 });
await page.waitForTimeout(6000);
await shot(page, "razorpay-checkout-open");
log("   Checkout is open");

// --- hand over for a manual payment ---------------------------------------
//
// The modal is not automated on purpose. Measured against this account:
//   • UPI is disabled, so success@razorpay is unavailable.
//   • Card is domestic-only — 4111 1111 1111 1111 is an international test
//     card and is rejected with "this business accepts domestic (Indian) card
//     payments only".
//   • Netbanking is enabled across 44 banks and gives an explicit
//     Success/Failure simulator, which makes it the reliable instrument.
// Driving Razorpay's own DOM to do that would couple this to their markup.
log(`
10. Checkout is open — PAY IN THE BROWSER WINDOW NOW:

      → choose  Netbanking
      → pick any bank
      → click   Success  on the simulator

    (not UPI — disabled on this account; not card 4111… — international)

    Watching for up to ${Math.round(HOLD_MS / 1000)}s. The page flips to
    "Order confirmed" by itself the moment the payment lands.
`);

let paid = false;
try {
  await page
    .getByRole("heading", { name: "Order confirmed" })
    .waitFor({ timeout: HOLD_MS });
  paid = true;
  log("    ✅ PAID — the order page flipped to Order confirmed");
  await shot(page, "order-confirmed-online");
  await page.waitForTimeout(4000);
} catch {
  const heading = await page
    .getByRole("heading", { level: 1 })
    .innerText()
    .catch(() => "(page navigated)");
  log(`    no payment completed in the window. Page still shows: "${heading}"`);
  await shot(page, "order-final-state");
}

await browser.close();

log(`
━━━ SUMMARY ━━━
  online payment        : ${paid ? "COMPLETED ✅" : "not completed"}
  pay-on-delivery order : ${codNumber}
                          ${codUrl}
  online-payment order  : ${rzpNumber}
                          ${payUrl.replace("?pay=1", "")}
  screenshots           : ${SHOTS}/

  Both orders are LEFT IN THE DATABASE on purpose. See them at:
    /kitchen              the kitchen queue for their slot
    the URLs above        each customer-facing order page
  Remove them with:  npm run test:e2e:clean
`);
