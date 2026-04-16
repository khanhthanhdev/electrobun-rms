import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  activateQualificationScheduleApi,
  createProvisionedEvent,
  saveQualificationAllianceScoreApi,
} from "../support/api-helpers";

const setupControlEvent = async (
  request: APIRequestContext
): Promise<{ eventCode: string; token: string }> => {
  const { eventCode, token } = await createProvisionedEvent(request, {
    generateQualificationSchedule: true,
    teamCount: 4,
  });
  await activateQualificationScheduleApi(request, token, eventCode);
  return { eventCode, token };
};

const findControlStatusRow = (page: Page, label: string) =>
  page.locator(".match-control-status-row", {
    hasText: label,
  });

test("runs load->preview->ready->start->abort transitions from match control action bar", async ({
  page,
  request,
}) => {
  const { eventCode } = await setupControlEvent(request);

  await page.goto(`/event/${eventCode}/control`);
  await expect(
    page.getByRole("cell", { exact: true, name: "Q1" })
  ).toBeVisible();

  const loadedRow = findControlStatusRow(page, "Loaded Match:");
  const activeRow = findControlStatusRow(page, "Active Match:");

  const loadNextButton = page.getByRole("button", { name: "Load Next Match" });
  const showPreviewButton = page.getByRole("button", { name: "Show Preview" });
  const showMatchButton = page.getByRole("button", { name: "Show Match" });
  const startMatchButton = page.getByRole("button", { name: "Start Match" });
  const commitButton = page.getByRole("button", {
    name: "Commit & Post Last Match",
  });

  await expect(loadedRow).toContainText("No match loaded");
  await expect(loadNextButton).toBeEnabled();
  await expect(showPreviewButton).toBeDisabled();
  await expect(showMatchButton).toBeDisabled();
  await expect(startMatchButton).toBeDisabled();
  await expect(commitButton).toBeDisabled();

  await loadNextButton.click();
  await expect(loadedRow).toContainText("Q1");
  await expect(loadedRow).toContainText("Not Started");
  await expect(showPreviewButton).toBeEnabled();

  await showPreviewButton.click();
  await expect(loadedRow).toContainText("Preview");
  await expect(showMatchButton).toBeEnabled();
  await expect(startMatchButton).toBeDisabled();

  await showMatchButton.click();
  await expect(loadedRow).toContainText("Ready");
  await expect(startMatchButton).toBeEnabled();

  await startMatchButton.click();
  const abortMatchButton = page.getByRole("button", { name: "Abort Match" });
  await expect(abortMatchButton).toBeVisible();
  await expect(activeRow).toContainText("In Progress");

  await abortMatchButton.click();
  const abortDialog = page.locator(".match-control-dialog");
  await expect(abortDialog).toBeVisible();
  await abortDialog.getByRole("button", { name: "Abort" }).click();

  await expect(loadedRow).toContainText("Not Started");
  await expect(activeRow).toContainText("—");
  await expect(showPreviewButton).toBeEnabled();
});

test("updates schedule row state from incomplete to committed as scores are posted", async ({
  page,
  request,
}) => {
  const { eventCode, token } = await setupControlEvent(request);

  await saveQualificationAllianceScoreApi(request, token, eventCode, {
    alliance: "red",
  });

  await page.goto(`/event/${eventCode}/control`);
  await expect(
    page.getByRole("cell", { exact: true, name: "Q1" })
  ).toBeVisible();

  const q1Row = page.locator("table.match-control-table tbody tr").filter({
    has: page.getByRole("cell", { exact: true, name: "Q1" }),
  });
  await expect(q1Row).toContainText("Incomplete");

  await page.getByRole("tab", { name: "Incomplete Matches" }).click();
  await expect(q1Row).toContainText("Q1");
  await expect(q1Row).toContainText("Incomplete");

  await saveQualificationAllianceScoreApi(request, token, eventCode, {
    alliance: "blue",
  });
  await page.getByRole("button", { name: "Refresh" }).click();

  await page.getByRole("tab", { name: "Schedule" }).click();
  await expect(q1Row).toContainText("Committed");

  await page.getByRole("tab", { name: "Incomplete Matches" }).click();
  await expect(page.getByRole("cell", { exact: true, name: "Q1" })).toHaveCount(
    0
  );
});
