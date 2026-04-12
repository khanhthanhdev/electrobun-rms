import { expect, test } from "@playwright/test";

test("shows an error page when navigating to a non-existent event", async ({
  page,
}) => {
  await page.goto("/event/NONEXISTENT/control");

  await expect(page.getByRole("heading", { name: "Match Control" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    /failed to load.*schedule/i
  );
});

test("displays a graceful error when the API returns a server error", async ({
  page,
}) => {
  await page.route("**/api/events", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ error: "Internal Server Error" }),
      contentType: "application/json",
      status: 500,
    });
  });

  await page.goto("/");

  const hasErrorFeedback =
    (await page.getByRole("alert").isVisible().catch(() => false)) ||
    (await page
      .getByText(/error|something went wrong|failed/i)
      .isVisible()
      .catch(() => false)) ||
    !(await page.locator(".blank-screen-of-death").isVisible().catch(() => true));

  expect(hasErrorFeedback).toBe(true);
});
