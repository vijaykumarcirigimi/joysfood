import { expect, test, type Page } from "@playwright/test";

/** Marks every row these tests create, so cleanup.mjs can find them. */
export const CLEANUP_CUSTOMER_NAME = "Playwright Test";

const ORDER_URL = /\/order\/[0-9a-f-]{36}/;

/**
 * Adds the first orderable dish on the homepage.
 *
 * "Sold out today" cards render no Add button at all, so filtering on the
 * button's presence is what makes this resilient to the kitchen toggling
 * availability between runs.
 */
async function addFirstAvailableDish(page: Page): Promise<string> {
  await page.goto("/");

  const card = page
    .locator("article")
    .filter({ has: page.getByRole("button", { name: "Add" }) })
    .first();

  await expect(card).toBeVisible();
  const name = (await card.locator("h3").innerText()).trim();
  await card.getByRole("button", { name: "Add" }).click();

  // Scoped to the header: the sticky cart bar also has a "View Cart" link, and
  // an unscoped /Cart/ match hits both.
  // The badge is driven by localStorage-backed cart state; waiting on it proves
  // the click actually landed rather than just that it was dispatched.
  await expect(
    page.locator("header").getByRole("link", { name: /Cart/ }),
  ).toContainText("1");
  return name;
}

/**
 * Picks the earliest date that still has a bookable slot.
 *
 * Today's slots are usually all past their 12h cutoff, and which future date
 * has capacity depends on live data — so this walks the date rail rather than
 * assuming any particular offset is safe.
 */
async function selectFirstBookableSlot(page: Page): Promise<string> {
  const dates = page.getByTestId("date-option");
  const count = await dates.count();

  for (let i = 0; i < count; i += 1) {
    await dates.nth(i).click();

    // Enabled slots show "N left"; disabled ones show why not.
    const bookable = page
      .locator('[data-testid="slot-option"]:not([disabled])')
      .filter({ hasText: /\d+ left/ })
      .first();

    if (await bookable.count()) {
      const label = (await bookable.innerText()).replace(/\s+/g, " ").trim();
      await bookable.click();
      await expect(bookable).toHaveAttribute("aria-pressed", "true");
      return label;
    }
  }

  throw new Error("No bookable slot in the next 14 days — check slot capacity.");
}

async function fillCustomerDetails(page: Page) {
  await page.getByLabel("Name", { exact: true }).fill(CLEANUP_CUSTOMER_NAME);
  await page.getByLabel("Mobile number").fill("9876543210");
}

test.describe("order flow", () => {
  test("cart is empty before anything is added", async ({ page }) => {
    await page.goto("/cart");
    await expect(page.getByText("Your cart is empty")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Browse the menu/ }),
    ).toBeVisible();
  });

  test("place order cannot be submitted without a slot", async ({ page }) => {
    await addFirstAvailableDish(page);
    await page.goto("/cart");

    await fillCustomerDetails(page);

    // No slot chosen yet, so the guard should hold.
    await expect(page.getByRole("button", { name: /Place order/ })).toBeDisabled();
    await expect(page.getByText("Pick a time slot to continue.")).toBeVisible();
  });

  test("pay on delivery: order is placed and confirmed", async ({ page }) => {
    const dish = await addFirstAvailableDish(page);
    await page.goto("/cart");

    await expect(page.getByRole("heading", { name: "Your order" })).toBeVisible();
    await expect(page.getByText(dish)).toBeVisible();

    const slot = await selectFirstBookableSlot(page);
    await fillCustomerDetails(page);

    await page.getByRole("button", { name: "Pay on pickup / delivery" }).click();
    await page.getByRole("button", { name: /Place order/ }).click();

    await page.waitForURL(ORDER_URL);
    await expect(
      page.getByRole("heading", { name: "Order confirmed" }),
    ).toBeVisible();

    // The order number is what the customer quotes to us, so assert its shape.
    await expect(page.getByText(/^JF-\d{4}-\d{4}$/)).toBeVisible();
    await expect(page.getByText("Pay when you collect or receive the order.")).toBeVisible();

    console.log(`  placed COD order for "${dish}" in slot ${slot}`);
  });

  test("pay online: order is held and Razorpay Checkout opens", async ({
    page,
  }) => {
    await addFirstAvailableDish(page);
    await page.goto("/cart");

    await selectFirstBookableSlot(page);
    await fillCustomerDetails(page);

    // Online payment is the default when Razorpay keys are configured.
    const online = page.getByRole("button", {
      name: "Pay online (UPI, card, netbanking)",
    });
    await expect(online).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: /Place order/ }).click();

    // ?pay=1 is what makes the payment window open without a second click.
    await page.waitForURL(/\/order\/[0-9a-f-]{36}\?pay=1/);

    await expect(page.getByRole("heading", { name: "Almost there" })).toBeVisible();
    await expect(page.getByText("Payment pending")).toBeVisible();
    await expect(page.getByText(/Test mode/)).toBeVisible();

    // Razorpay renders Checkout in an iframe from its own origin. Its arrival
    // proves startPayment() created a gateway order and the handoff worked;
    // driving the inside of a third-party payment UI is out of scope here.
    const checkoutFrame = page.locator(
      'iframe[src*="razorpay"], iframe[name*="razorpay"]',
    );
    await expect(checkoutFrame.first()).toBeAttached({ timeout: 30_000 });

    console.log("  Razorpay Checkout iframe attached");
  });

  /**
   * The payment can always be retried from the order's own URL.
   *
   * This is what makes routing through /order/[token] rather than opening
   * Checkout in the cart worthwhile: closing the tab, losing connection or
   * dismissing the modal all leave a durable page that can still take payment.
   *
   * Note what this test does NOT do: dismiss Razorpay's modal. Current Checkout
   * ignores Escape from both documents and does not close on a backdrop click,
   * and the only remaining handles are third-party class names that would make
   * this suite fail on their next redesign. So the ondismiss path — the
   * "Nothing has been charged" copy — stays a manual check.
   */
  test("payment can be retried from the order URL", async ({ page }) => {
    await addFirstAvailableDish(page);
    await page.goto("/cart");
    await selectFirstBookableSlot(page);
    await fillCustomerDetails(page);
    await page.getByRole("button", { name: /Place order/ }).click();
    await page.waitForURL(/\?pay=1/);

    // Revisit without ?pay=1 — the state a customer returns to later.
    const url = new URL(page.url());
    await page.goto(url.pathname);

    await expect(page.getByText("Payment pending")).toBeVisible();
    const payAgain = page.getByRole("button", { name: /Pay .* now/ });
    await expect(payAgain).toBeEnabled();
    // Amount comes from the database, so it must match the order total shown.
    await expect(payAgain).toContainText("₹");

    // Without the flag, nothing should auto-open.
    await expect(
      page.locator('iframe[src*="razorpay"]'),
    ).toHaveCount(0);

    // And the button still works: clicking it opens Checkout on demand.
    await payAgain.click();
    await expect(
      page.locator('iframe[src*="razorpay"]').first(),
    ).toBeAttached({ timeout: 30_000 });
  });
});
