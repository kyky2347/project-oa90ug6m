import { defineConfig, devices } from "@playwright/test";
const baseURL = process.env.PULSE_E2E_URL || "http://127.0.0.1:3000";
export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  expect: { timeout: 20000 },
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    {
      name: "smoke",
      testMatch: "smoke.spec.ts",
      use: { baseURL: "http://127.0.0.1:3100", ...devices["Desktop Chrome"] },
    },
    {
      name: "real-london",
      testMatch: "london.spec.ts",
      use: {
        baseURL,
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          args: [
            "--enable-webgl",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
          ],
        },
      },
    },
  ],
  webServer: process.env.PULSE_E2E_REAL
    ? undefined
    : {
        command: "PORT=3100 pnpm start",
        url: "http://127.0.0.1:3100",
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
});
