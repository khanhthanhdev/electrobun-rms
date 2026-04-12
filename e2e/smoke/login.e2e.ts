import { expect, test } from "@playwright/test";
import { loginAsDefaultAdmin } from "../support/session-helpers";

test.use({
  storageState: {
    cookies: [],
    origins: [],
  },
});

test("logs in with the seeded default admin account", async ({ page }) => {
  await loginAsDefaultAdmin(page);

  await expect(
    page.locator("details.site-header__admin-menu summary")
  ).toHaveText("ADMIN");
});
