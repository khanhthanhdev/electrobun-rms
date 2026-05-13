import { expect, test } from "@playwright/test";
import {
  activateQualificationScheduleApi,
  createProvisionedEvent,
} from "../support/api-helpers";

test("publishes control-page display commands to the audience display", async ({
  context,
  page,
  request,
}) => {
  const { eventCode } = await createProvisionedEvent(request, {
    teamCount: 1,
  });

  const displayPage = await context.newPage();

  await Promise.all([
    page.goto(`/event/${eventCode}/control`),
    displayPage.goto(`/event/${eventCode}/display`),
  ]);

  await page.getByRole("tab", { name: "Settings" }).click();

  await page.getByRole("button", { name: "Show Inspection Status" }).click();
  await expect(
    displayPage.getByRole("heading", { name: "Robot Inspection" })
  ).toBeVisible();
  await expect(displayPage.getByText("Test Team 1")).toBeVisible();

  await page.getByRole("button", { name: "Show Message" }).click();
  await expect(displayPage.getByText("Wait for next match")).toBeVisible();

  await page.getByRole("button", { name: "Show Ranks & Results" }).click();
  await expect(displayPage.getByText("No rankings yet")).toBeVisible();

  await page.getByRole("button", { name: "Show Sponsors" }).click();
  await expect(
    displayPage.getByRole("heading", { name: "Nhà tài trợ" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Show Blank Screen" }).click();
  await expect(displayPage.locator(".display-scene-blank")).toBeVisible();

  await displayPage.close();
});

test("switches audience display scenes during control lifecycle transitions", async ({
  context,
  page,
  request,
}) => {
  const { eventCode, token } = await createProvisionedEvent(request, {
    generateQualificationSchedule: true,
    qualificationMatchesPerTeam: 1,
    teamCount: 3,
  });
  await activateQualificationScheduleApi(request, token, eventCode);

  const displayPage = await context.newPage();

  await Promise.all([
    page.goto(`/event/${eventCode}/control`),
    displayPage.goto(`/event/${eventCode}/display`),
  ]);

  await expect(
    page.getByRole("cell", { exact: true, name: "Q1" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Load Next Match" }).click();
  await page.getByRole("button", { name: "Show Preview" }).click();
  await expect(
    displayPage.locator(".display-match-preview-scene")
  ).toBeVisible();

  await page.getByRole("button", { name: "Show Match" }).click();
  const timer = displayPage.locator(".display-match-start-timer");
  await expect(displayPage.locator(".display-match-start-scene")).toBeVisible();
  await expect(timer).toHaveText("8:00");

  await page.getByRole("button", { name: "Start Match" }).click();
  await expect(page.getByRole("button", { name: "Abort Match" })).toBeVisible();
  await expect(timer).not.toHaveText("8:00", { timeout: 12_000 });

  await page.getByRole("button", { name: "Abort Match" }).click();
  const abortDialog = page.locator(".match-control-dialog");
  await expect(abortDialog).toBeVisible();
  await abortDialog.getByRole("button", { name: "Abort" }).click();
  await expect(displayPage.locator(".display-scene-blank")).toBeVisible();

  await displayPage.close();
});
