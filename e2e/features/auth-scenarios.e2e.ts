import { expect, test } from "@playwright/test";

const EMPTY_CREDENTIALS_ERROR_PATTERN =
  /invalid length|expected >=1|required/i;
const INVALID_LOGIN_ERROR_PATTERN = /invalid username or password/i;

test.describe("unauthenticated auth scenarios", () => {
  test.use({
    storageState: {
      cookies: [],
      origins: [],
    },
  });

  test("shows an error for invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.locator("#username").fill("admin");
    await page.locator("#password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/login");
    await expect(page.getByText(INVALID_LOGIN_ERROR_PATTERN)).toBeVisible();
  });

  test("shows validation feedback when submitting empty credentials", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/login");
    await expect(page.getByText(EMPTY_CREDENTIALS_ERROR_PATTERN)).toBeVisible();
  });

  test("redirects unauthenticated user from protected route to login", async ({
    page,
  }) => {
    await page.goto("/create/event");

    await expect(page).toHaveURL("/create/event");
    await expect(page.getByRole("alert")).toContainText("Admin access required.");
    await expect(page.getByRole("link", { name: "Back to Home" })).toBeVisible();
  });
});

test.describe("authenticated auth scenarios", () => {
  test("logs out and returns to the public shell", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator(".site-header__user")).toHaveText("admin");
    await page.getByRole("button", { name: "Log out" }).click();

    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
    await expect(page.locator(".site-header__user")).toHaveCount(0);
  });
});
