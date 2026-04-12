import { expect, type Page, test } from "@playwright/test";
import { openAdminMenu } from "../support/session-helpers";

const USERNAME_LABEL_PATTERN = /username/i;

async function navigateFromAdminMenu(
  page: Page,
  linkName: string
): Promise<void> {
  await openAdminMenu(page);
  await page.getByRole("link", { name: linkName }).click();
}

test("navigates to setup event", async ({ page }) => {
  await page.goto("/");
  await navigateFromAdminMenu(page, "Setup Event");

  await expect(page).toHaveURL("/create/event");
  await expect(
    page.getByRole("heading", { name: "Create Manual Event" })
  ).toBeVisible();
});

test("navigates to sync event", async ({ page }) => {
  await page.goto("/");
  await navigateFromAdminMenu(page, "Sync Event");

  await expect(page).toHaveURL("/sync/event");
  await expect(
    page.getByRole("heading", { name: "Sync Event from NRC Web" })
  ).toBeVisible();
});

test("navigates to create user", async ({ page }) => {
  await page.goto("/");
  await navigateFromAdminMenu(page, "Create User");

  await expect(page).toHaveURL("/create/account");
  await expect(page.getByLabel(USERNAME_LABEL_PATTERN)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create Account" })
  ).toBeVisible();
});

test("navigates to manage users", async ({ page }) => {
  await page.goto("/");
  await navigateFromAdminMenu(page, "Manage Users");

  await expect(page).toHaveURL("/user/manage");
  await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
});

test("navigates to manage server", async ({ page }) => {
  await page.goto("/");
  await navigateFromAdminMenu(page, "Manage Server");

  await expect(page).toHaveURL("/manage/server");
  await expect(
    page.getByRole("heading", { name: "Manage Server" })
  ).toBeVisible();
});
