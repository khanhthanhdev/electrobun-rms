import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { createProvisionedEvent } from "../support/api-helpers";

const findInspectionRow = (page: Page, teamName: string) =>
  page.locator("table.inspection-teams-table tbody tr").filter({
    hasText: teamName,
  });

test("shows inspection notes and condensed filtering for commented teams", async ({
  page,
  request,
}) => {
  const { eventCode } = await createProvisionedEvent(request, {
    teamCount: 2,
  });

  await page.goto(`/event/${eventCode}/inspection`);

  const teamOneRow = findInspectionRow(page, "Test Team 1");
  await teamOneRow.getByRole("link", { name: "Inspect" }).click();
  await expect(page).toHaveURL(`/event/${eventCode}/inspection/1`);

  await page.getByRole("button", { name: "Mark In Progress" }).click();
  await page
    .getByPlaceholder("Comments or reason for incomplete...")
    .fill("Battery inspection pending");
  await page.getByRole("button", { name: "Save Comment" }).click();

  await page.goto(`/event/${eventCode}/inspection`);
  await page.getByRole("link", { name: "View Inspection Notes" }).click();

  await expect(
    page.getByRole("heading", {
      name: `Robot Inspection Notes - ${eventCode}`,
    })
  ).toBeVisible();

  const notesTeamOneRow = findInspectionRow(page, "Test Team 1");
  const notesTeamTwoRow = findInspectionRow(page, "Test Team 2");
  await expect(notesTeamOneRow).toContainText("In Progress");
  await expect(notesTeamOneRow).toContainText("Battery inspection pending");
  await expect(notesTeamTwoRow).toBeVisible();

  await page.getByRole("checkbox", { name: "Condensed" }).check();
  await expect(notesTeamOneRow).toBeVisible();
  await expect(notesTeamTwoRow).toHaveCount(0);
});

test("updates team statuses from the override page and syncs back to inspection list", async ({
  page,
  request,
}) => {
  const { eventCode } = await createProvisionedEvent(request, {
    teamCount: 2,
  });

  await page.goto(`/event/${eventCode}/inspection`);
  await page.getByRole("link", { name: "Lead Inspector Override" }).click();

  await expect(
    page.getByRole("heading", {
      name: `Robot Inspection Override - ${eventCode}`,
    })
  ).toBeVisible();

  const overrideRow = findInspectionRow(page, "Test Team 1");

  await overrideRow.locator("button").first().click();
  await overrideRow.getByRole("button", { name: "Incomplete" }).click();
  await expect(overrideRow).toContainText("Incomplete");

  await overrideRow.locator("button").first().click();
  await overrideRow.getByRole("button", { name: "Passed" }).click();
  await expect(overrideRow).toContainText("Passed");
  await expect(page.getByText("50% Passed")).toBeVisible();

  await page.getByRole("link", { name: /Back to Team Select/i }).click();
  await expect(page).toHaveURL(`/event/${eventCode}/inspection`);

  const inspectionRow = findInspectionRow(page, "Test Team 1");
  await expect(inspectionRow).toContainText("Passed");
});
