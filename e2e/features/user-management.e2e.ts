import { expect, test } from "@playwright/test";
import { createUsername } from "../support/api-helpers";

test("creates, updates, and deletes a user account", async ({ page }) => {
  const username = createUsername("acct");

  await page.goto("/create/account");
  await expect(
    page
      .locator(".table-role-matrix tbody tr")
      .first()
      .locator('input[type="checkbox"]')
      .first()
  ).toBeVisible();

  await page.locator("#username").fill(username);
  await page.locator("#password").fill("secret123");
  await page.locator("#passwordConfirm").fill("secret123");
  await page
    .locator(".table-role-matrix tbody tr")
    .first()
    .locator('input[type="checkbox"]')
    .first()
    .check();
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(page.getByRole("alert")).toContainText(
    `Account "${username}" was created.`
  );

  await page.goto("/user/manage");
  const createdUserRow = page.locator("table tbody tr").filter({
    hasText: username,
  });
  await expect(createdUserRow).toBeVisible();
  await createdUserRow.getByRole("button", { name: "Manage User" }).click();

  await expect(page).toHaveURL(`/user/manage/${username}`);
  await page.locator("#password").fill("secret456");
  await page.locator("#passwordConfirm").fill("secret456");
  await page.getByRole("button", { name: "Update Account" }).click();
  await expect(page.getByRole("alert")).toContainText(
    `Account "${username}" was updated.`
  );

  await page.getByRole("button", { name: "Delete Account" }).click();
  await expect(
    page.getByRole("button", { name: "Delete Account (Confirm)" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete Account (Confirm)" }).click();

  await expect(page).toHaveURL("/user/manage");
  await expect(
    page.locator("table tbody tr").filter({ hasText: username })
  ).toHaveCount(0);
});

test("shows an error when creating an account with mismatched passwords", async ({
  page,
}) => {
  const username = createUsername("mismatch");

  await page.goto("/create/account");

  await page.locator("#username").fill(username);
  await page.locator("#password").fill("password1");
  await page.locator("#passwordConfirm").fill("password2");
  await page
    .locator(".table-role-matrix tbody tr")
    .first()
    .locator('input[type="checkbox"]')
    .first()
    .check();
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL("/create/account");
});

test("shows an error when creating a duplicate username", async ({ page }) => {
  const username = createUsername("dup");

  await page.goto("/create/account");
  await page.locator("#username").fill(username);
  await page.locator("#password").fill("secret123");
  await page.locator("#passwordConfirm").fill("secret123");
  await page
    .locator(".table-role-matrix tbody tr")
    .first()
    .locator('input[type="checkbox"]')
    .first()
    .check();
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page.getByRole("alert")).toContainText(
    `Account "${username}" was created.`
  );

  await page.goto("/create/account");
  await page.locator("#username").fill(username);
  await page.locator("#password").fill("secret123");
  await page.locator("#passwordConfirm").fill("secret123");
  await page
    .locator(".table-role-matrix tbody tr")
    .first()
    .locator('input[type="checkbox"]')
    .first()
    .check();
  await page.getByRole("button", { name: "Create Account" }).click();

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL("/create/account");
});
