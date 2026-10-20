import { defineConfig, devices } from "@playwright/test";

// End-to-end tests need the app running against a real Supabase project or the local stack
// (`npm run db:start && npm run db:reset`), with email confirmations disabled.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  fullyParallel: false,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    permissions: ["clipboard-read", "clipboard-write"],
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run build && npm run start", url: "http://localhost:3000", reuseExistingServer: true, timeout: 300_000 },
});
