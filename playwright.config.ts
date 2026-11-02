import { scryptSync } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

// End-to-end tests: a whole game in real browser engines, Chrome's (Chromium) and Safari's
// (WebKit), at laptop, tablet and phone sizes. Run with `npm run test:e2e` (builds first).
//
// The app runs on its own port with a test-only account and session secret, never a real one.
export const E2E_USER = "tester";
export const E2E_PASSWORD = "e2e-test-only-password";
const salt = Buffer.from("e2e-test-only-salt");
const users = `${E2E_USER}:scrypt:${salt.toString("base64")}:${scryptSync(E2E_PASSWORD, salt, 32).toString("base64")}`;
const PORT = 3200;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  workers: 2, // more browsers at once overload a laptop and time out for no fault of the app
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "chrome-laptop", use: { ...devices["Desktop Chrome"] } },
    { name: "safari-laptop", use: { ...devices["Desktop Safari"] } },
    { name: "safari-iphone", use: { ...devices["iPhone 13"] } },
    { name: "safari-iphone-se", use: { ...devices["iPhone SE (3rd gen)"] } },
    { name: "safari-ipad", use: { ...devices["iPad (gen 7)"] } },
    { name: "chrome-android", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    env: { SESSION_SECRET: "e2e-test-only-session-secret", APP_USERS: users, APP_USERS_FILE: "" },
  },
});
