import { expect, test } from "@playwright/test";

const APP_TITLE_PATTERN = /Robotics Tournament Management/i;

test.use({
  storageState: {
    cookies: [],
    origins: [],
  },
});

test("renders the public shell for unauthenticated users", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(APP_TITLE_PATTERN);
  await expect(
    page.getByRole("link", { name: "Nation Robotics Competition" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);
});
