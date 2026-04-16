import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import {
  activateQualificationScheduleApi,
  createProvisionedEvent,
} from "../support/api-helpers";

const createControlReadyEvent = async (
  request: APIRequestContext
): Promise<{ eventCode: string; token: string }> => {
  const { eventCode, token } = await createProvisionedEvent(request, {
    generateQualificationSchedule: true,
    qualificationMatchesPerTeam: 1,
    teamCount: 3,
  });
  await activateQualificationScheduleApi(request, token, eventCode);
  return { eventCode, token };
};

const findStatusRow = (page: Page, rowLabel: string) =>
  page.locator(".match-control-status-row", {
    hasText: rowLabel,
  });

const REALTIME_TIMEOUT_MS = 20_000;
const MATCH_AUTO_COMPLETE_TIMEOUT_MS = 190_000;
const RUN_FULL_WORKFLOW_COLLAB =
  process.argv.includes("-full") || process.argv.includes("--full");

const expectStatusRowToContain = async (
  row: Locator,
  expectedText: string
): Promise<void> => {
  await expect
    .poll(async () => (await row.textContent()) ?? "", {
      timeout: REALTIME_TIMEOUT_MS,
    })
    .toContain(expectedText);
};

test("synchronizes match control state across concurrent operator pages", async ({
  context,
  page,
  request,
}) => {
  const { eventCode } = await createControlReadyEvent(request);
  const operatorTwoPage = await context.newPage();

  await Promise.all([
    page.goto(`/event/${eventCode}/control`),
    operatorTwoPage.goto(`/event/${eventCode}/control`),
  ]);

  const operatorOneLoadedRow = findStatusRow(page, "Loaded Match:");
  const operatorTwoLoadedRow = findStatusRow(operatorTwoPage, "Loaded Match:");

  await expect(operatorOneLoadedRow).toContainText("No match loaded");
  await expect(operatorTwoLoadedRow).toContainText("No match loaded");

  await page.getByRole("button", { name: "Load Next Match" }).click();
  await expectStatusRowToContain(operatorOneLoadedRow, "Q1");
  await expectStatusRowToContain(operatorTwoLoadedRow, "Q1");
  await expectStatusRowToContain(operatorTwoLoadedRow, "Not Started");

  await operatorTwoPage.getByRole("button", { name: "Show Preview" }).click();
  await expectStatusRowToContain(operatorOneLoadedRow, "Preview");

  await page.getByRole("button", { name: "Show Match" }).click();
  await expect(
    operatorTwoPage.getByRole("button", { name: "Start Match" })
  ).toBeEnabled({ timeout: REALTIME_TIMEOUT_MS });

  await operatorTwoPage.close();
});

test("shows conflict feedback and recovers when a stale transition version is submitted", async ({
  page,
  request,
}) => {
  const { eventCode } = await createControlReadyEvent(request);

  await page.goto(`/event/${eventCode}/control`);
  await page.getByRole("button", { name: "Load Next Match" }).click();

  const previewEndpoint = `**/api/events/${eventCode}/match-control/show-preview`;
  let forcedConflict = false;
  await page.route(previewEndpoint, async (route) => {
    if (forcedConflict) {
      await route.continue();
      return;
    }

    forcedConflict = true;
    const requestBody = JSON.parse(route.request().postData() ?? "{}");
    await route.continue({
      headers: {
        ...route.request().headers(),
        "content-type": "application/json",
      },
      postData: JSON.stringify({
        ...requestBody,
        expectedVersion: 0,
      }),
    });
  });

  await page.getByRole("button", { name: "Show Preview" }).click();
  await expect(page.getByRole("alert")).toContainText("State was out of sync");
  await expect(findStatusRow(page, "Loaded Match:")).toContainText(
    "Not Started"
  );

  await page.getByRole("button", { name: "Show Preview" }).click();
  await expect(findStatusRow(page, "Loaded Match:")).toContainText("Preview");
});

test("propagates inspection status updates to other pages without manual refresh", async ({
  context,
  page,
  request,
}) => {
  const { eventCode } = await createProvisionedEvent(request, {
    teamCount: 1,
  });
  const observerPage = await context.newPage();

  await Promise.all([
    page.goto(`/event/${eventCode}/inspection`),
    observerPage.goto(`/event/${eventCode}/inspection`),
  ]);

  const observerTeamRow = observerPage
    .locator("table.inspection-teams-table tbody tr")
    .filter({
      hasText: "Test Team 1",
    });
  await expect(observerTeamRow).toContainText("Not Started");

  const actorTeamRow = page
    .locator("table.inspection-teams-table tbody tr")
    .filter({
      hasText: "Test Team 1",
    });
  await actorTeamRow.getByRole("link", { name: "Inspect" }).click();
  await expect(page).toHaveURL(`/event/${eventCode}/inspection/1`);

  await page.getByRole("button", { name: "Mark In Progress" }).click();
  await expect(
    page.locator(".inspection-header-top-row .inspection-cell-status")
  ).toHaveText("In Progress");

  await expect(observerTeamRow).toContainText("In Progress");
  await observerPage.close();
});

test("simulates the full match workflow from control start to head referee review", async ({
  context,
  page,
  request,
}) => {
  test.skip(
    !RUN_FULL_WORKFLOW_COLLAB,
    "Skipped by default. Run with -full to include the full workflow collaboration scenario."
  );
  test.setTimeout(260_000);

  const { eventCode } = await createControlReadyEvent(request);
  const displayPage = await context.newPage();
  const redRefereePage = await context.newPage();
  const blueRefereePage = await context.newPage();
  const headRefPage = await context.newPage();

  await Promise.all([
    page.goto(`/event/${eventCode}/control`),
    displayPage.goto(`/event/${eventCode}/display`),
    redRefereePage.goto(`/event/${eventCode}/ref/red/scoring/1/quals/match/1`),
    blueRefereePage.goto(
      `/event/${eventCode}/ref/blue/scoring/1/quals/match/1`
    ),
    headRefPage.goto(`/event/${eventCode}/hr/1`),
  ]);

  const loadedRow = findStatusRow(page, "Loaded Match:");
  const activeRow = findStatusRow(page, "Active Match:");
  await expect(loadedRow).toContainText("No match loaded");
  await expect(activeRow).toContainText("—");

  await page.getByRole("button", { name: "Load Next Match" }).click();
  await page.getByRole("button", { name: "Show Preview" }).click();
  await expect(displayPage.locator(".display-match-preview-scene")).toBeVisible(
    {
      timeout: REALTIME_TIMEOUT_MS,
    }
  );

  await page.getByRole("button", { name: "Show Match" }).click();
  const displayTimer = displayPage.locator(".display-match-start-timer");
  await expect(displayPage.locator(".display-match-start-scene")).toBeVisible({
    timeout: REALTIME_TIMEOUT_MS,
  });
  await expect(displayTimer).toHaveText("2:30");

  await page.getByRole("button", { name: "Start Match" }).click();
  await expect(activeRow).toContainText("In Progress");
  await expect(displayTimer).not.toHaveText("2:30", { timeout: 12_000 });

  const redLiveScore = headRefPage.locator(
    ".hr-live-score--red .hr-live-score-value"
  );
  const blueLiveScore = headRefPage.locator(
    ".hr-live-score--blue .hr-live-score-value"
  );
  const controlRedLiveScore = page.locator(
    ".match-control-active-scores .match-control-red-team .match-control-active-score-value"
  );
  const controlBlueLiveScore = page.locator(
    ".match-control-active-scores .match-control-blue-team .match-control-active-score-value"
  );
  const displayRedScore = displayPage.locator(
    ".display-match-start-board-total-score--red"
  );
  const displayBlueScore = displayPage.locator(
    ".display-match-start-board-total-score--blue"
  );

  await expect(redLiveScore).toHaveText("0");
  await expect(blueLiveScore).toHaveText("0");
  await expect(displayRedScore).toHaveText("00");
  await expect(displayBlueScore).toHaveText("00");

  await redRefereePage.getByRole("button", { name: "+" }).first().click();
  await redRefereePage.getByRole("button", { name: "Submit Score" }).click();
  await expect(
    redRefereePage.getByRole("heading", { name: "Score Submitted" })
  ).toBeVisible();
  await expect(controlRedLiveScore).toContainText("25", {
    timeout: REALTIME_TIMEOUT_MS,
  });
  await expect(controlBlueLiveScore).toContainText("0");
  await expect(displayRedScore).toHaveText("25", {
    timeout: REALTIME_TIMEOUT_MS,
  });
  await expect(displayBlueScore).toHaveText("00");
  await headRefPage.reload();
  await expect(redLiveScore).toHaveText("25");
  await expect(blueLiveScore).toHaveText("0");

  await blueRefereePage.getByRole("button", { name: "+" }).first().click();
  await blueRefereePage.getByRole("button", { name: "Submit Score" }).click();
  await expect(
    blueRefereePage.getByRole("heading", { name: "Score Submitted" })
  ).toBeVisible();
  await expect(controlRedLiveScore).toContainText("25", {
    timeout: REALTIME_TIMEOUT_MS,
  });
  await expect(controlBlueLiveScore).toContainText("25", {
    timeout: REALTIME_TIMEOUT_MS,
  });
  await expect(displayRedScore).toHaveText("25", {
    timeout: REALTIME_TIMEOUT_MS,
  });
  await expect(displayBlueScore).toHaveText("25", {
    timeout: REALTIME_TIMEOUT_MS,
  });
  await headRefPage.reload();
  await expect(redLiveScore).toHaveText("25");
  await expect(blueLiveScore).toHaveText("25");

  const penaltyValue = headRefPage
    .locator(".hr-scoring-grid .hr-counter-value")
    .first();
  const penaltyPlusButton = headRefPage
    .locator(".hr-scoring-grid .hr-counter")
    .first()
    .getByRole("button", { name: "+" });
  await expect(penaltyValue).toHaveText("0");
  await penaltyPlusButton.click();
  await expect(penaltyValue).toHaveText("1");

  const commitButton = page.getByRole("button", {
    name: "Commit & Post Last Match",
  });
  await expect(commitButton).toBeEnabled({
    timeout: MATCH_AUTO_COMPLETE_TIMEOUT_MS,
  });
  await expect(activeRow).toContainText("Complete", {
    timeout: MATCH_AUTO_COMPLETE_TIMEOUT_MS,
  });

  await commitButton.click();
  await expect(activeRow).toContainText("—");
  await expect(displayPage.locator(".display-scene-match-winner")).toBeVisible({
    timeout: REALTIME_TIMEOUT_MS,
  });

  await Promise.all([
    displayPage.close(),
    redRefereePage.close(),
    blueRefereePage.close(),
    headRefPage.close(),
  ]);
});

test("keeps two audience displays synchronized to the same commanded scenes", async ({
  context,
  page,
  request,
}) => {
  const { eventCode } = await createControlReadyEvent(request);
  const displayPageA = await context.newPage();
  const displayPageB = await context.newPage();

  await Promise.all([
    page.goto(`/event/${eventCode}/control`),
    displayPageA.goto(`/event/${eventCode}/display`),
    displayPageB.goto(`/event/${eventCode}/display`),
  ]);
  await expect(displayPageA.getByLabel("Audience display")).toBeVisible();
  await expect(displayPageB.getByLabel("Audience display")).toBeVisible();
  const loadedRow = findStatusRow(page, "Loaded Match:");
  const loadNextButton = page.getByRole("button", { name: "Load Next Match" });
  const showPreviewButton = page.getByRole("button", { name: "Show Preview" });
  await expectStatusRowToContain(loadedRow, "No match loaded");
  await expect(loadNextButton).toBeEnabled();

  await loadNextButton.click();
  await expectStatusRowToContain(loadedRow, "Not Started");
  await expect(showPreviewButton).toBeEnabled({ timeout: REALTIME_TIMEOUT_MS });
  await showPreviewButton.click();
  await expect(
    displayPageA.locator(".display-match-preview-scene")
  ).toBeVisible({
    timeout: REALTIME_TIMEOUT_MS,
  });
  await expect(
    displayPageB.locator(".display-match-preview-scene")
  ).toBeVisible({
    timeout: REALTIME_TIMEOUT_MS,
  });

  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Show Message" }).click();
  await expect(displayPageA.getByText("Wait for next match")).toBeVisible({
    timeout: REALTIME_TIMEOUT_MS,
  });
  await expect(displayPageB.getByText("Wait for next match")).toBeVisible({
    timeout: REALTIME_TIMEOUT_MS,
  });

  await page.getByRole("button", { name: "Show Inspection Status" }).click();
  await expect(
    displayPageA.getByRole("heading", { name: "Robot Inspection" })
  ).toBeVisible({ timeout: REALTIME_TIMEOUT_MS });
  await expect(
    displayPageB.getByRole("heading", { name: "Robot Inspection" })
  ).toBeVisible({ timeout: REALTIME_TIMEOUT_MS });

  await page.getByRole("button", { name: "Show Sponsors" }).click();
  await expect(
    displayPageA.getByRole("heading", { name: "Nhà tài trợ" })
  ).toBeVisible({
    timeout: REALTIME_TIMEOUT_MS,
  });
  await expect(
    displayPageB.getByRole("heading", { name: "Nhà tài trợ" })
  ).toBeVisible({
    timeout: REALTIME_TIMEOUT_MS,
  });

  await Promise.all([displayPageA.close(), displayPageB.close()]);
});
