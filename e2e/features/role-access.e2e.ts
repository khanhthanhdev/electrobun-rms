import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from "@playwright/test";
import {
  createEventRoleUserApi,
  createUsername,
  createProvisionedEvent,
  type E2eRoleValue,
  loginAsAdminApi,
} from "../support/api-helpers";
import { loginAsUser } from "../support/session-helpers";

const API_BASE_URL = "http://127.0.0.1:3102/api";

interface ProvisionRoleSessionOptions {
  generateQualificationSchedule?: boolean;
  role: E2eRoleValue;
  teamCount?: number;
  usernamePrefix?: string;
}

interface ProvisionMultiRoleSessionOptions {
  generateQualificationSchedule?: boolean;
  roles: E2eRoleValue[];
  teamCount?: number;
  usernamePrefix?: string;
}

interface RoleCredentials {
  password: string;
  username: string;
}

async function provisionRoleAccount(
  request: APIRequestContext,
  options: ProvisionRoleSessionOptions
): Promise<{ credentials: RoleCredentials; eventCode: string }> {
  const adminToken = await loginAsAdminApi(request);
  const { eventCode } = await createProvisionedEvent(request, {
    generateQualificationSchedule: options.generateQualificationSchedule,
    teamCount: options.teamCount ?? 0,
    token: adminToken,
  });

  const credentials = await createEventRoleUserApi(request, adminToken, {
    eventCode,
    role: options.role,
    usernamePrefix: options.usernamePrefix,
  });

  return { credentials, eventCode };
}

async function createMultiRoleUserApi(
  request: APIRequestContext,
  token: string,
  options: {
    eventCode: string;
    roles: E2eRoleValue[];
    usernamePrefix?: string;
  }
): Promise<RoleCredentials> {
  const username = createUsername(options.usernamePrefix ?? "multirole");
  const password = `pw${username}123`;

  const response = await request.post(`${API_BASE_URL}/users`, {
    data: {
      password,
      passwordConfirm: password,
      roles: options.roles.map((role) => ({
        event: options.eventCode,
        role,
      })),
      username,
    },
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  expect(response.ok()).toBeTruthy();

  return { password, username };
}

async function provisionRoleSession(
  page: Page,
  request: APIRequestContext,
  options: ProvisionRoleSessionOptions
): Promise<{ credentials: RoleCredentials; eventCode: string }> {
  const provisioned = await provisionRoleAccount(request, options);
  const { credentials } = provisioned;
  await loginAsUser(page, credentials);
  return provisioned;
}

async function provisionMultiRoleSession(
  page: Page,
  request: APIRequestContext,
  options: ProvisionMultiRoleSessionOptions
): Promise<{ credentials: RoleCredentials; eventCode: string }> {
  const adminToken = await loginAsAdminApi(request);
  const { eventCode } = await createProvisionedEvent(request, {
    generateQualificationSchedule: options.generateQualificationSchedule,
    teamCount: options.teamCount ?? 0,
    token: adminToken,
  });
  const credentials = await createMultiRoleUserApi(request, adminToken, {
    eventCode,
    roles: options.roles,
    usernamePrefix: options.usernamePrefix,
  });

  await loginAsUser(page, credentials);
  return { credentials, eventCode };
}

async function loginAsRoleApi(
  request: APIRequestContext,
  credentials: RoleCredentials
): Promise<string> {
  const response = await request.post(`${API_BASE_URL}/auth/login`, {
    data: credentials,
  });
  expect(response.ok()).toBeTruthy();

  const body = (await response.json()) as { token: string };
  return body.token;
}

async function expectForbiddenApiResponse(
  response: Awaited<ReturnType<APIRequestContext["fetch"]>>,
  messagePattern: RegExp
): Promise<void> {
  expect(response.status()).toBe(403);
  const body = (await response.json()) as {
    error?: string;
    message?: string;
  };
  expect(body.error).toBe("Forbidden");
  expect(body.message).toMatch(messagePattern);
}

async function expectInspectionTeamsVisible(
  page: Page,
  eventCode: string,
  expectedTeamRows: number
): Promise<void> {
  await page.goto(`/event/${eventCode}/inspection`);
  await expect(
    page.getByRole("heading", { name: `Inspection - ${eventCode}` })
  ).toBeVisible();
  await expect(
    page.locator("table.inspection-teams-table tbody tr")
  ).toHaveCount(expectedTeamRows);
}

test.describe("role-based event access", () => {
  test.use({
    storageState: {
      cookies: [],
      origins: [],
    },
  });

  const inspectorAccessRoles: Array<{
    role: E2eRoleValue;
    usernamePrefix: string;
  }> = [
    { role: "HEAD_REFEREE", usernamePrefix: "hr" },
    { role: "INSPECTOR", usernamePrefix: "insp" },
    { role: "TSO", usernamePrefix: "tso" },
  ];

  for (const roleCase of inspectorAccessRoles) {
    test(`${roleCase.role} can access inspection teams`, async ({
      page,
      request,
    }) => {
      const { eventCode } = await provisionRoleSession(page, request, {
        role: roleCase.role,
        teamCount: 2,
        usernamePrefix: roleCase.usernamePrefix,
      });
      await expectInspectionTeamsVisible(page, eventCode, 2);
    });
  }

  test("LEAD_INSPECTOR can access inspection override", async ({
    page,
    request,
  }) => {
    const { eventCode } = await provisionRoleSession(page, request, {
      role: "LEAD_INSPECTOR",
      teamCount: 2,
      usernamePrefix: "lead",
    });

    await page.goto(`/event/${eventCode}/inspection/override`);

    await expect(
      page.getByRole("heading", { name: `Robot Inspection Override - ${eventCode}` })
    ).toBeVisible();
    await expect(
      page.locator("table.inspection-teams-table tbody tr")
    ).toHaveCount(2);
  });

  const nonAdminRoles: Array<{ role: E2eRoleValue; usernamePrefix: string }> = [
    { role: "HEAD_REFEREE", usernamePrefix: "hrdash" },
    { role: "REFEREE", usernamePrefix: "refdash" },
    { role: "INSPECTOR", usernamePrefix: "inspdsh" },
    { role: "JUDGE", usernamePrefix: "judgedsh" },
  ];

  for (const roleCase of nonAdminRoles) {
    test(`${roleCase.role} is denied event dashboard`, async ({
      page,
      request,
    }) => {
      const { eventCode } = await provisionRoleSession(page, request, {
        role: roleCase.role,
        usernamePrefix: roleCase.usernamePrefix,
      });

      await page.goto(`/event/${eventCode}/dashboard`);
      await expect(page.getByRole("alert")).toContainText(
        `Admin access for event "${eventCode}" is required.`
      );
    });
  }

  test("REFEREE is denied inspection teams", async ({ page, request }) => {
    const { eventCode } = await provisionRoleSession(page, request, {
      role: "REFEREE",
      teamCount: 1,
      usernamePrefix: "ref",
    });

    await page.goto(`/event/${eventCode}/inspection`);

    await expect(page.getByRole("alert")).toContainText(
      "Inspector access required."
    );
    await expect(
      page.getByRole("heading", { name: `Inspection - ${eventCode}` })
    ).toHaveCount(0);
  });

  test("REFEREE can access scoring field selection", async ({
    page,
    request,
  }) => {
    const { eventCode } = await provisionRoleSession(page, request, {
      role: "REFEREE",
      usernamePrefix: "refscore",
      teamCount: 4,
      generateQualificationSchedule: true,
    });

    await page.goto(`/event/${eventCode}/ref/red/scoring`);

    await expect(page.getByText("Field Selection (Scoring)")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "All Matches" })
    ).toBeVisible();
  });

  test("REFEREE can access scoring match entry", async ({
    page,
    request,
  }) => {
    const { eventCode } = await provisionRoleSession(page, request, {
      role: "REFEREE",
      usernamePrefix: "refmatch",
      teamCount: 4,
      generateQualificationSchedule: true,
    });

    await page.goto(`/event/${eventCode}/ref/red/scoring/1/quals/match/1`);

    await expect(page.getByRole("heading", { name: "Score Submitted" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Submit Score" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back to Selection" })).toBeVisible();
  });

  test("HEAD_REFEREE can access head referee field selection", async ({
    page,
    request,
  }) => {
    const { eventCode } = await provisionRoleSession(page, request, {
      role: "HEAD_REFEREE",
      usernamePrefix: "hrfield",
    });

    await page.goto(`/event/${eventCode}/hr`);

    await expect(page.getByText("Field Selection")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "All Matches" })
    ).toBeVisible();
  });

  test("HEAD_REFEREE + LEAD_INSPECTOR can access both HR and override pages", async ({
    page,
    request,
  }) => {
    const { eventCode } = await provisionMultiRoleSession(page, request, {
      roles: ["HEAD_REFEREE", "LEAD_INSPECTOR"],
      teamCount: 2,
      usernamePrefix: "hrlead",
    });

    await page.goto(`/event/${eventCode}/hr`);
    await expect(page.getByText("Field Selection")).toBeVisible();

    await page.goto(`/event/${eventCode}/inspection/override`);
    await expect(
      page.getByRole("heading", {
        name: `Robot Inspection Override - ${eventCode}`,
      })
    ).toBeVisible();
    await expect(
      page.locator("table.inspection-teams-table tbody tr")
    ).toHaveCount(2);
  });

  test("HEAD_REFEREE + LEAD_INSPECTOR can apply override but cannot access event dashboard", async ({
    page,
    request,
  }) => {
    const { credentials, eventCode } = await provisionMultiRoleSession(
      page,
      request,
      {
        roles: ["HEAD_REFEREE", "LEAD_INSPECTOR"],
        teamCount: 1,
        usernamePrefix: "hrleadperm",
      }
    );
    const roleToken = await loginAsRoleApi(request, credentials);

    const overrideResponse = await request.fetch(
      `${API_BASE_URL}/events/${eventCode}/inspection/teams/1/override`,
      {
        data: {
          comment: "Combined-role user can perform lead-inspector override.",
        },
        headers: {
          Authorization: `Bearer ${roleToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      }
    );
    expect(overrideResponse.ok()).toBeTruthy();

    await page.goto(`/event/${eventCode}/dashboard`);
    await expect(page.getByRole("alert")).toContainText(
      `Admin access for event "${eventCode}" is required.`
    );
  });

  test("HEAD_REFEREE cannot apply lead inspector override action", async ({
    request,
  }) => {
    const { credentials, eventCode } = await provisionRoleAccount(request, {
      role: "HEAD_REFEREE",
      teamCount: 1,
      usernamePrefix: "hroverride",
    });
    const roleToken = await loginAsRoleApi(request, credentials);

    const response = await request.fetch(
      `${API_BASE_URL}/events/${eventCode}/inspection/teams/1/override`,
      {
        data: { comment: "Override from head referee should be denied." },
        headers: {
          Authorization: `Bearer ${roleToken}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      }
    );

    await expectForbiddenApiResponse(response, /Lead Inspector access required/i);
  });

  test("REFEREE cannot submit scoring updates", async ({ request }) => {
    const { credentials, eventCode } = await provisionRoleAccount(request, {
      role: "REFEREE",
      teamCount: 1,
      usernamePrefix: "refnoscore",
    });
    const roleToken = await loginAsRoleApi(request, credentials);

    const response = await request.fetch(
      `${API_BASE_URL}/events/${eventCode}/scoring/matches`,
      {
        data: {
          aCenterFlags: 0,
          aFirstTierFlags: 0,
          aSecondTierFlags: 0,
          alliance: "red",
          bBaseFlagsDown: 0,
          bCenterFlagDown: 0,
          cOpponentBackfieldBullets: 0,
          dGoldFlagsDefended: 0,
          dRobotParkState: 0,
          matchNumber: 1,
          matchType: "quals",
        },
        headers: {
          Authorization: `Bearer ${roleToken}`,
          "Content-Type": "application/json",
        },
        method: "PUT",
      }
    );

    await expectForbiddenApiResponse(
      response,
      new RegExp(`Admin access for event \"${eventCode}\" is required.`, "i")
    );
  });
});
