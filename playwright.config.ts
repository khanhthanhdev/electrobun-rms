import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const e2eBaseUrl = "http://127.0.0.1:3102";
const isCi = process.env.CI === "true";
const includeWebkit = process.env.PW_INCLUDE_WEBKIT === "true";
const storageStatePath = resolve(
  process.cwd(),
  "playwright",
  ".auth",
  "admin.json"
);

const browserProjects = [
  {
    name: "chromium",
    dependencies: ["setup"],
    testMatch: /.*\.e2e\.ts/,
    use: {
      ...devices["Desktop Chrome"],
      storageState: storageStatePath,
    },
  },
  {
    name: "firefox",
    dependencies: ["setup"],
    testMatch: /.*\.e2e\.ts/,
    use: {
      ...devices["Desktop Firefox"],
      storageState: storageStatePath,
    },
  },
  ...(includeWebkit
    ? [
        {
          name: "webkit",
          dependencies: ["setup"],
          testMatch: /.*\.e2e\.ts/,
          use: {
            ...devices["Desktop Safari"],
            storageState: storageStatePath,
          },
        },
      ]
    : []),
];

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  forbidOnly: isCi,
  fullyParallel: false,
  outputDir: "test-results",
  reporter: isCi
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  retries: isCi ? 2 : 0,
  use: {
    baseURL: e2eBaseUrl,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "bun run e2e:server",
    reuseExistingServer: !isCi,
    timeout: 120_000,
    url: `${e2eBaseUrl}/health`,
  },
  workers: 1,
  projects: [
    {
      name: "setup",
      testMatch: /.*admin-auth\.setup\.ts/,
    },
    ...browserProjects,
  ],
});
