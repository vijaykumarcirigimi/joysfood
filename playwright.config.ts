import { defineConfig, devices } from "@playwright/test";

/**
 * These tests place REAL orders in whatever Supabase project .env.local points
 * at, and each one consumes a seat in a real time slot.
 *
 * Two consequences shape this config:
 *   - workers: 1. Parallel runs would race each other for slot capacity and
 *     produce failures that look like bugs but are just contention.
 *   - Every order is placed under CLEANUP_CUSTOMER_NAME so it can be found and
 *     deleted afterwards. See e2e/cleanup.mjs.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"]],

  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // The slot picker filters on the browser's clock, so pin it to the
    // kitchen's timezone — a machine in UTC sees a different set of open slots.
    timezoneId: "Asia/Kolkata",
    locale: "en-IN",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
