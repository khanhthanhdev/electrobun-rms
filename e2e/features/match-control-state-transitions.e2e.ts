import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  activateQualificationScheduleApi,
  createProvisionedEvent,
  saveQualificationAllianceScoreApi,
} from "../support/api-helpers";

const API_BASE_URL = "http://127.0.0.1:3102/api";

interface MatchControlStateApiResponse {
  state: {
    version: number;
  };
}

interface MatchControlErrorResponse {
  error?: string;
  message?: string;
}

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

const fetchMatchControlVersion = async (
  request: APIRequestContext,
  eventCode: string
): Promise<number> => {
  const response = await request.fetch(
    `${API_BASE_URL}/events/${eventCode}/match-control/state`
  );
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as MatchControlStateApiResponse;
  return body.state.version;
};

const postMatchControlTransitionApi = async (
  request: APIRequestContext,
  token: string,
  eventCode: string,
  path: string,
  expectedVersion: number
) =>
  request.fetch(`${API_BASE_URL}/events/${eventCode}/match-control/${path}`, {
    data: { expectedVersion },
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    method: "POST",
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

test("auto-unloads staged READY match then loads next match", async ({
  page,
  request,
}) => {
  const { eventCode } = await setupControlEvent(request);

  await page.goto(`/event/${eventCode}/control`);
  await expect(
    page.getByRole("cell", { exact: true, name: "Q1" })
  ).toBeVisible();

  const loadedRow = findControlStatusRow(page, "Loaded Match:");
  const loadNextButton = page.getByRole("button", { name: "Load Next Match" });

  await loadNextButton.click();
  await expect(loadedRow).toContainText("Q1");
  await expect(loadedRow).toContainText("Not Started");

  await page.getByRole("button", { name: "Show Preview" }).click();
  await page.getByRole("button", { name: "Show Match" }).click();
  await expect(loadedRow).toContainText("Ready");

  // Frontend auto-unloads Q1 before loading Q2
  await loadNextButton.click();
  await expect(loadedRow).toContainText("Q2");
  await expect(loadedRow).toContainText("Not Started");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("syncs UNLOAD transition from API to control page and rejects redundant UNLOAD", async ({
  page,
  request,
}) => {
  const { eventCode, token } = await setupControlEvent(request);

  await page.goto(`/event/${eventCode}/control`);
  await expect(
    page.getByRole("cell", { exact: true, name: "Q1" })
  ).toBeVisible();

  const loadedRow = findControlStatusRow(page, "Loaded Match:");
  await page.getByRole("button", { name: "Load Next Match" }).click();
  await expect(loadedRow).toContainText("Q1");

  const unloadVersion = await fetchMatchControlVersion(request, eventCode);
  const unloadResponse = await postMatchControlTransitionApi(
    request,
    token,
    eventCode,
    "unload",
    unloadVersion
  );
  expect(unloadResponse.ok()).toBeTruthy();
  await expect(loadedRow).toContainText("No match loaded");

  const unloadAgainVersion = await fetchMatchControlVersion(request, eventCode);
  const unloadAgainResponse = await postMatchControlTransitionApi(
    request,
    token,
    eventCode,
    "unload",
    unloadAgainVersion
  );
  expect(unloadAgainResponse.status()).toBe(409);
  const body = (await unloadAgainResponse.json()) as MatchControlErrorResponse;
  expect(body.error).toBe("INVALID_TRANSITION");
  expect(body.message).toContain("No match is loaded to unload.");
});
