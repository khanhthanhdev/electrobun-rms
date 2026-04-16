import { expect, test } from "@playwright/test";
import {
  createProvisionedEvent,
  rebuildQualificationRankingsApi,
  saveQualificationMatchScoresApi,
} from "../support/api-helpers";

const BACK_TO_MATCH_RESULTS_PATTERN = /Back to Match Results/i;

// Derived from api-helpers score bodies + season-2025-2026 scoring rules:
// Red: aCenterFlags(3)*10 + bBaseFlagsDown(2)*10 + parkFull(2)=15 → 65
// Blue: aCenterFlags(1)*10 + bBaseFlagsDown(1)*10 + parkPartial(1)=10 → 30
const EXPECTED_RED_SCORE = "65";
const EXPECTED_BLUE_SCORE = "30";

test("generates a practice schedule and shows it on the public schedule page", async ({
  page,
  request,
}) => {
  const { eventCode } = await createProvisionedEvent(request, {
    teamCount: 4,
  });

  await page.goto(`/event/${eventCode}/dashboard/schedule/practice`);
  await page.getByRole("button", { name: "Generate" }).click();

  await expect(page.locator('output[data-variant="success"]')).toContainText(
    "Generated"
  );
  await expect(
    page.getByRole("cell", { exact: true, name: "Practice 1" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Activate" }).click();
  await expect(page.getByRole("button", { name: "Deactivate" })).toBeVisible();

  await page.goto(`/event/${eventCode}/practice`);
  await expect(
    page.getByRole("heading", {
      name: `${eventCode.toUpperCase()} Practice Schedule`,
    })
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { exact: true, name: "Practice 1" })
  ).toBeVisible();
});

test("generates a qualification schedule and covers rankings plus result drill-down pages", async ({
  page,
  request,
}) => {
  const { eventCode, token } = await createProvisionedEvent(request, {
    teamCount: 4,
  });

  await page.goto(`/event/${eventCode}/dashboard/schedule/quals`);
  await page.getByRole("button", { name: "Generate" }).click();

  await expect(page.locator('output[data-variant="success"]')).toContainText(
    "qualification matches"
  );
  await expect(
    page.getByRole("cell", { exact: true, name: "Quals 1" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Activate" }).click();
  await expect(page.getByRole("button", { name: "Deactivate" })).toBeVisible();

  await page.goto(`/event/${eventCode}/qual`);
  await expect(
    page.getByRole("heading", {
      name: `${eventCode.toUpperCase()} Qualification Schedule`,
    })
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { exact: true, name: "Qualification 1" })
  ).toBeVisible();

  await saveQualificationMatchScoresApi(request, token, eventCode);
  await rebuildQualificationRankingsApi(request, token, eventCode);

  await page.goto(`/event/${eventCode}/results`);
  await page.getByRole("button", { name: "Qualification" }).click();

  let firstResultRow = page.locator("table tbody tr").filter({
    has: page.getByRole("cell", { exact: true, name: "Q1" }),
  });
  await expect(firstResultRow).toContainText(EXPECTED_RED_SCORE);
  await expect(firstResultRow).toContainText(EXPECTED_BLUE_SCORE);
  await expect(
    firstResultRow.getByRole("link", { name: "[Scoresheet]" })
  ).toBeVisible();

  await firstResultRow.getByRole("link", { name: "[Scoresheet]" }).click();
  await expect(
    page.getByRole("heading", { name: "Scoresheet for Q1" })
  ).toBeVisible();
  await expect(page.getByText("Red Alliance Scoring")).toBeVisible();
  await expect(page.getByText("Blue Alliance Scoring")).toBeVisible();
  await expect(
    page.getByText(EXPECTED_RED_SCORE, { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText(EXPECTED_BLUE_SCORE, { exact: true })
  ).toBeVisible();

  await page.getByRole("link", { name: BACK_TO_MATCH_RESULTS_PATTERN }).click();
  firstResultRow = page.locator("table tbody tr").filter({
    has: page.getByRole("cell", { exact: true, name: "Q1" }),
  });

  await firstResultRow.getByRole("link", { name: "[Red]" }).click();
  await expect(
    page.getByRole("heading", { name: "Scoresheet for Q1" })
  ).toBeVisible();
  await expect(page.getByText("Red Alliance Scoring")).toBeVisible();
  await expect(page.getByText("Blue Alliance Scoring")).toHaveCount(0);

  await page.goto(`/event/${eventCode}/results`);
  await page.getByRole("button", { name: "Qualification" }).click();
  firstResultRow = page.locator("table tbody tr").filter({
    has: page.getByRole("cell", { exact: true, name: "Q1" }),
  });

  await firstResultRow.getByRole("link", { name: "[Match History]" }).click();
  await expect(
    page.getByRole("heading", { name: "History for Q1" })
  ).toBeVisible();
  await expect(page.getByText("Blue Ref Save")).toBeVisible();
  await expect(page.getByText("Red Ref Save")).toBeVisible();

  await page.goto(`/event/${eventCode}/qualification/rankings`);
  await expect(
    page.getByRole("heading", {
      name: `${eventCode.toUpperCase()} Rankings`,
    })
  ).toBeVisible();
  await expect(page.locator(".ranking-table tbody tr")).toHaveCount(4);
  await expect(page.getByText("Test Team 1")).toBeVisible();
});
