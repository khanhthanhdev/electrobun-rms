import { expect, type Page } from "@playwright/test";

const DEFAULT_ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_PASSWORD = "admin1234";
const PASSWORD_LABEL_PATTERN = /^password$/i;
const USERNAME_LABEL_PATTERN = /username/i;

export async function loginAsUser(
  page: Page,
  credentials: { password: string; username: string }
): Promise<void> {
  await page.goto("/login");

  await expect(
    page.getByRole("heading", {
      name: "Sign in",
    })
  ).toBeVisible();

  await page.getByLabel(USERNAME_LABEL_PATTERN).fill(credentials.username);
  await page.getByLabel(PASSWORD_LABEL_PATTERN).fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  await expect(page.locator(".site-header__user")).toHaveText(
    credentials.username
  );
}

export async function loginAsDefaultAdmin(page: Page): Promise<void> {
  await loginAsUser(page, {
    password: DEFAULT_ADMIN_PASSWORD,
    username: DEFAULT_ADMIN_USERNAME,
  });
}

export async function openAdminMenu(page: Page): Promise<void> {
  const adminMenu = page.locator("details.site-header__admin-menu");
  const summary = adminMenu.locator("summary");

  await expect(summary).toBeVisible();

  if ((await adminMenu.getAttribute("open")) === null) {
    await summary.click();
  }
}
