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
    teamCount: 4,
  });
  await activateQualificationScheduleApi(request, token, eventCode);
  return { eventCode, token };
};

const findStatusRow = (page: Page, rowLabel: string) =>
  page.locator(".match-control-status-row", {
    hasText: rowLabel,
  });

const REALTIME_TIMEOUT_MS = 20_000;

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
  await expect(page.getByRole("alert")).toContainText(
    "State was out of sync"
  );
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
    teamCount: 4,
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

  const actorTeamRow = page.locator("table.inspection-teams-table tbody tr").filter({
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

test("aggregates red and blue referee score submissions for head referee view", async ({
  context,
  page,
  request,
}) => {
  const { eventCode } = await createControlReadyEvent(request);
  const redRefereePage = await context.newPage();
  const blueRefereePage = await context.newPage();
  const headRefPage = await context.newPage();

  await Promise.all([
    page.goto(`/event/${eventCode}/control`),
    redRefereePage.goto(`/event/${eventCode}/ref/red/scoring/1/quals/match/1`),
    blueRefereePage.goto(
      `/event/${eventCode}/ref/blue/scoring/1/quals/match/1`
    ),
    headRefPage.goto(`/event/${eventCode}/hr/1`),
  ]);

  const redLiveScore = headRefPage.locator(
    ".hr-live-score--red .hr-live-score-value"
  );
  const blueLiveScore = headRefPage.locator(
    ".hr-live-score--blue .hr-live-score-value"
  );
  await expect(redLiveScore).toHaveText("0");
  await expect(blueLiveScore).toHaveText("0");

  await redRefereePage.getByRole("button", { name: "+" }).first().click();
  await redRefereePage.getByRole("button", { name: "Submit Score" }).click();
  await expect(
    redRefereePage.getByRole("heading", { name: "Score Submitted" })
  ).toBeVisible();

  await headRefPage.reload();
  await expect(redLiveScore).toHaveText("25");
  await expect(blueLiveScore).toHaveText("0");

  await blueRefereePage.getByRole("button", { name: "+" }).first().click();
  await blueRefereePage.getByRole("button", { name: "Submit Score" }).click();
  await expect(
    blueRefereePage.getByRole("heading", { name: "Score Submitted" })
  ).toBeVisible();

  await headRefPage.reload();
  await expect(redLiveScore).toHaveText("25");
  await expect(blueLiveScore).toHaveText("25");

  await Promise.all([
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
  await expectStatusRowToContain(findStatusRow(page, "Loaded Match:"), "No match loaded");
  await expect(page.getByRole("button", { name: "Load Next Match" })).toBeEnabled();

  await page.getByRole("button", { name: "Load Next Match" }).click();
  await page.getByRole("button", { name: "Show Preview" }).click();
  await expect(displayPageA.locator(".display-match-preview-scene")).toBeVisible({
    timeout: REALTIME_TIMEOUT_MS,
  });
  await expect(displayPageB.locator(".display-match-preview-scene")).toBeVisible({
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
  await expect(displayPageA.getByRole("heading", { name: "Nhà tài trợ" })).toBeVisible({
    timeout: REALTIME_TIMEOUT_MS,
  });
  await expect(displayPageB.getByRole("heading", { name: "Nhà tài trợ" })).toBeVisible({
    timeout: REALTIME_TIMEOUT_MS,
  });

  await Promise.all([displayPageA.close(), displayPageB.close()]);
});
