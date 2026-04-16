import type { APIRequestContext } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { createProvisionedEvent } from "../support/api-helpers";

const INSPECTION_API_BASE_URL = "http://127.0.0.1:3102/api";

const completeRequiredInspectionItemsApi = async (
  request: APIRequestContext,
  token: string,
  eventCode: string,
  teamNumber: number
): Promise<number> => {
  const detailResponse = await request.get(
    `${INSPECTION_API_BASE_URL}/events/${eventCode}/inspection/teams/${teamNumber}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  expect(detailResponse.ok()).toBeTruthy();

  const detail = (await detailResponse.json()) as {
    checklist: {
      items: Array<{
        inputType: "CHECKBOX" | "NUMBER" | "SELECT";
        key: string;
        options?: Array<{
          isSentinel?: boolean;
          key: string;
        }>;
        required: boolean;
      }>;
    };
  };

  const items = detail.checklist.items
    .filter((item) => item.required)
    .map((item) => {
      if (item.inputType === "CHECKBOX") {
        return { key: item.key, value: "true" };
      }
      if (item.inputType === "SELECT") {
        const selectableOption =
          item.options?.find((option) => !option.isSentinel)?.key ??
          item.options?.[0]?.key ??
          "selected";
        return { key: item.key, value: selectableOption };
      }
      return { key: item.key, value: "1" };
    });

  const updateResponse = await request.patch(
    `${INSPECTION_API_BASE_URL}/events/${eventCode}/inspection/teams/${teamNumber}/items`,
    {
      data: { items },
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
    }
  );
  expect(updateResponse.ok()).toBeTruthy();

  return items.length;
};

test("seeds teams, edits a team, and updates inspection status", async ({
  page,
  request,
}) => {
  const { eventCode } = await createProvisionedEvent(request);

  await page.goto(`/event/${eventCode}/dashboard/teams`);
  await page.locator("#seed-team-count").fill("4");
  await page.getByRole("button", { name: "Seed Test Teams" }).click();

  await expect(
    page.getByText("Seeded 4 test team(s).", { exact: false })
  ).toBeVisible();

  const firstTeamRow = page.locator("table.table-teams tbody tr").first();
  await expect(firstTeamRow).toContainText("Test Team 1");
  await firstTeamRow.getByRole("button", { name: "Edit" }).click();
  await firstTeamRow
    .locator('input[type="text"]')
    .first()
    .fill("Inspection Team 1");
  await firstTeamRow.getByRole("button", { name: "Save" }).click();

  await expect(
    page.getByText("Saved team 1 (Inspection Team 1).", { exact: false })
  ).toBeVisible();

  await page.goto(`/event/${eventCode}/inspection`);
  await expect(
    page.getByRole("heading", { name: `Inspection - ${eventCode}` })
  ).toBeVisible();
  await page.locator("#inspection-search").fill("Inspection Team 1");

  const filteredTeamRow = page
    .locator("table.inspection-teams-table tbody tr")
    .filter({
      hasText: "Inspection Team 1",
    });
  await expect(filteredTeamRow).toBeVisible();
  await filteredTeamRow.getByRole("link", { name: "Inspect" }).click();

  await expect(page).toHaveURL(`/event/${eventCode}/inspection/1`);
  await expect(
    page.getByRole("heading", { name: "General Comments" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Mark In Progress" }).click();
  await expect(
    page.locator(".inspection-header-top-row .inspection-cell-status")
  ).toHaveText("In Progress");

  await page
    .getByPlaceholder("Comments or reason for incomplete...")
    .fill("Ready for review");
  await page.getByRole("button", { name: "Save Comment" }).click();
  await expect(page.locator(".inspection-history-entry").first()).toContainText(
    "Status Change"
  );

  await page.locator("a.inspection-header-link").first().click();
  await expect(page).toHaveURL(`/event/${eventCode}/inspection`);
  await expect(filteredTeamRow).toContainText("In Progress");
});

test("completes full inspection lifecycle: Not Started → In Progress → Passed", async ({
  page,
  request,
}) => {
  const { eventCode, token } = await createProvisionedEvent(request, {
    teamCount: 2,
  });

  await page.goto(`/event/${eventCode}/inspection`);

  const teamRow = page
    .locator("table.inspection-teams-table tbody tr")
    .filter({ hasText: "Test Team 1" });
  await expect(teamRow).toContainText("Not Started");

  await teamRow.getByRole("link", { name: "Inspect" }).click();
  await expect(page).toHaveURL(`/event/${eventCode}/inspection/1`);

  await page.getByRole("button", { name: "Mark In Progress" }).click();
  await expect(
    page.locator(".inspection-header-top-row .inspection-cell-status")
  ).toHaveText("In Progress");

  const requiredCount = await completeRequiredInspectionItemsApi(
    request,
    token,
    eventCode,
    1
  );
  await page.reload();
  await expect(
    page.getByText(
      new RegExp(
        `Progress:\\s*${requiredCount}\\/${requiredCount} required items`
      )
    )
  ).toBeVisible();

  await page.getByRole("button", { name: "Pass" }).click();
  await expect(
    page.locator(".inspection-header-top-row .inspection-cell-status")
  ).toHaveText("Passed");

  await page.locator("a.inspection-header-link").first().click();
  await expect(page).toHaveURL(`/event/${eventCode}/inspection`);
  await expect(
    page
      .locator("table.inspection-teams-table tbody tr")
      .filter({ hasText: "Test Team 1" })
  ).toContainText("Passed");
});
