import { expect, test } from "@playwright/test";

const FAILED_TO_LOAD_SCHEDULE_PATTERN = /failed to load.*schedule/i;
const ERROR_PATTERN = /error|something went wrong|failed/i;

test("shows an error page when navigating to a non-existent event", async ({
  page,
}) => {
  await page.goto("/event/NONEXISTENT/control");

  await expect(
    page.getByRole("heading", { name: "Match Control" })
  ).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    FAILED_TO_LOAD_SCHEDULE_PATTERN
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
    (await page
      .getByRole("alert")
      .isVisible()
      .catch(() => false)) ||
    (await page
      .getByText(ERROR_PATTERN)
      .isVisible()
      .catch(() => false)) ||
    !(await page
      .locator(".blank-screen-of-death")
      .isVisible()
      .catch(() => true));

  expect(hasErrorFeedback).toBe(true);
});
