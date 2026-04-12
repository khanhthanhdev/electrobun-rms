import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { test as setup } from "@playwright/test";
import { adminStorageStatePath } from "../support/e2e-paths";
import { loginAsDefaultAdmin } from "../support/session-helpers";

setup("persist default admin session", async ({ page }) => {
  mkdirSync(dirname(adminStorageStatePath), { recursive: true });

  await loginAsDefaultAdmin(page);

  await page.context().storageState({
    path: adminStorageStatePath,
  });
});
