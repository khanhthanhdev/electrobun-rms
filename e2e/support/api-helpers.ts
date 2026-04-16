import { randomBytes } from "node:crypto";
import type { APIRequestContext, APIResponse } from "@playwright/test";

const ADMIN_PASSWORD = "admin1234";
const ADMIN_USERNAME = "admin";
const API_BASE_URL = "http://127.0.0.1:3102/api";
const DEFAULT_EVENT_END_DATE = "2026-04-11";
const DEFAULT_EVENT_START_DATE = "2026-04-10";
const EVENT_CODE_SANITIZE_PATTERN = /[^a-z0-9]/gi;
const USERNAME_SANITIZE_PATTERN = /[^a-z0-9_]/gi;

let uniqueCounter = 0;
let cachedAdminToken: string | null = null;

interface ApiRequestOptions {
  data?: unknown;
  method?: "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
  token?: string;
}

interface AuthResponse {
  token: string;
}

export type E2eRoleValue =
  | "ADMIN"
  | "TSO"
  | "HEAD_REFEREE"
  | "REFEREE"
  | "INSPECTOR"
  | "LEAD_INSPECTOR"
  | "JUDGE";

interface CreateEventResponse {
  event: {
    code: string;
    name: string;
  };
}

interface CreateUserResponse {
  user: {
    username: string;
  };
}

interface TeamSeed {
  teamName: string;
  teamNumber: number;
}

interface ProvisionEventOptions {
  eventCode?: string;
  eventName?: string;
  fields?: number;
  generateQualificationSchedule?: boolean;
  qualificationMatchesPerTeam?: number;
  teamCount?: number;
  token?: string;
}

interface QualificationScoreBody {
  aCenterFlags: number;
  aFirstTierFlags: number;
  alliance: "blue" | "red";
  aSecondTierFlags: number;
  bBaseFlagsDown: number;
  bCenterFlagDown: number;
  cOpponentBackfieldBullets: number;
  dGoldFlagsDefended: number;
  dRobotParkState: number;
  matchNumber: number;
  matchType: "quals";
}

interface CreateEventRoleUserOptions {
  eventCode: string;
  password?: string;
  role: E2eRoleValue;
  usernamePrefix?: string;
}

function buildUniqueFragment(): string {
  uniqueCounter += 1;
  return `${randomBytes(4).toString("hex")}${uniqueCounter.toString(36)}`;
}

async function readErrorMessage(response: APIResponse): Promise<string> {
  const fallbackMessage = `Request failed with status ${response.status()}`;
  const bodyText = await response.text();

  if (!bodyText) {
    return fallbackMessage;
  }

  try {
    const parsed = JSON.parse(bodyText) as {
      error?: string;
      message?: string;
    };

    return parsed.message ?? parsed.error ?? fallbackMessage;
  } catch {
    return bodyText;
  }
}

async function requestJson<TResponse>(
  request: APIRequestContext,
  path: string,
  options: ApiRequestOptions = {}
): Promise<TResponse> {
  const { data, method = "GET", token } = options;
  const headers: Record<string, string> = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (data !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await request.fetch(`${API_BASE_URL}${path}`, {
    data,
    headers,
    method,
  });

  if (!response.ok()) {
    throw new Error(await readErrorMessage(response));
  }

  return (await response.json()) as TResponse;
}

export function createEventCode(prefix = "e"): string {
  const compactPrefix =
    prefix.replace(EVENT_CODE_SANITIZE_PATTERN, "").toLowerCase() || "e";
  return `${compactPrefix}${buildUniqueFragment()}`.slice(0, 8);
}

export function createUsername(prefix = "user"): string {
  const compactPrefix =
    prefix.replace(USERNAME_SANITIZE_PATTERN, "").toLowerCase() || "user";
  return `${compactPrefix}${buildUniqueFragment()}`.slice(0, 24);
}

export async function createEventRoleUserApi(
  request: APIRequestContext,
  token: string,
  options: CreateEventRoleUserOptions
): Promise<{ password: string; username: string }> {
  const username = createUsername(options.usernamePrefix ?? "role");
  const password = options.password ?? `pw${buildUniqueFragment()}`;

  const response = await requestJson<CreateUserResponse>(request, "/users", {
    data: {
      password,
      passwordConfirm: password,
      roles: [
        {
          event: options.eventCode,
          role: options.role,
        },
      ],
      username,
    },
    method: "POST",
    token,
  });

  return {
    password,
    username: response.user.username,
  };
}

export async function loginAsAdminApi(
  request: APIRequestContext
): Promise<string> {
  if (cachedAdminToken) {
    return cachedAdminToken;
  }

  const response = await requestJson<AuthResponse>(request, "/auth/login", {
    data: {
      password: ADMIN_PASSWORD,
      username: ADMIN_USERNAME,
    },
    method: "POST",
  });

  cachedAdminToken = response.token;
  return response.token;
}

export async function createManualEventApi(
  request: APIRequestContext,
  token: string,
  overrides: ProvisionEventOptions = {}
): Promise<{ eventCode: string; eventName: string }> {
  const eventCode = overrides.eventCode ?? createEventCode();
  const eventName =
    overrides.eventName ?? `E2E Event ${eventCode.toUpperCase()}`;

  const response = await requestJson<CreateEventResponse>(
    request,
    "/events/manual",
    {
      data: {
        divisions: 1,
        endDate: DEFAULT_EVENT_END_DATE,
        eventCode,
        eventName,
        eventType: 1,
        fields: overrides.fields ?? 1,
        region: "Vietnam",
        startDate: DEFAULT_EVENT_START_DATE,
      },
      method: "POST",
      token,
    }
  );

  return {
    eventCode: response.event.code,
    eventName: response.event.name,
  };
}

export async function seedTeamsApi(
  request: APIRequestContext,
  token: string,
  eventCode: string,
  teamCount: number
): Promise<TeamSeed[]> {
  const teams: TeamSeed[] = [];

  for (let index = 0; index < teamCount; index += 1) {
    const teamNumber = index + 1;
    const teamName = `Test Team ${teamNumber}`;

    await requestJson(request, `/events/${eventCode}/teams`, {
      data: {
        city: "Test City",
        country: "Test Country",
        organizationSchool: "Seeded Team",
        teamName,
        teamNumber,
      },
      method: "POST",
      token,
    });

    teams.push({
      teamName,
      teamNumber,
    });
  }

  return teams;
}

export async function generateQualificationScheduleApi(
  request: APIRequestContext,
  token: string,
  eventCode: string,
  matchesPerTeam = 4
): Promise<void> {
  await requestJson(request, `/events/${eventCode}/schedule/quals/generate`, {
    data: {
      cycleTimeSeconds: 240,
      fieldCount: 1,
      fieldStartOffsetSeconds: 15,
      matchesPerTeam,
      startTime: Date.UTC(2026, 3, 10, 1, 0, 0),
    },
    method: "POST",
    token,
  });
}

export async function activateQualificationScheduleApi(
  request: APIRequestContext,
  token: string,
  eventCode: string
): Promise<void> {
  await requestJson(request, `/events/${eventCode}/schedule/quals/active`, {
    data: {
      active: true,
    },
    method: "PUT",
    token,
  });
}

export async function rebuildQualificationRankingsApi(
  request: APIRequestContext,
  token: string,
  eventCode: string
): Promise<void> {
  await requestJson(
    request,
    `/events/${eventCode}/qualification-rankings/rebuild`,
    {
      method: "POST",
      token,
    }
  );
}

export async function saveQualificationAllianceScoreApi(
  request: APIRequestContext,
  token: string,
  eventCode: string,
  options: {
    alliance: "blue" | "red";
    matchNumber?: number;
  }
): Promise<void> {
  const scoreBodyByAlliance: Record<"blue" | "red", QualificationScoreBody> = {
    red: {
      aCenterFlags: 3,
      aFirstTierFlags: 0,
      aSecondTierFlags: 0,
      alliance: "red",
      bBaseFlagsDown: 2,
      bCenterFlagDown: 0,
      cOpponentBackfieldBullets: 0,
      dGoldFlagsDefended: 0,
      dRobotParkState: 2,
      matchNumber: options.matchNumber ?? 1,
      matchType: "quals",
    },
    blue: {
      aCenterFlags: 1,
      aFirstTierFlags: 0,
      aSecondTierFlags: 0,
      alliance: "blue",
      bBaseFlagsDown: 1,
      bCenterFlagDown: 0,
      cOpponentBackfieldBullets: 0,
      dGoldFlagsDefended: 0,
      dRobotParkState: 1,
      matchNumber: options.matchNumber ?? 1,
      matchType: "quals",
    },
  };

  await requestJson(request, `/events/${eventCode}/scoring/matches`, {
    data: scoreBodyByAlliance[options.alliance],
    method: "PUT",
    token,
  });
}

export async function saveQualificationMatchScoresApi(
  request: APIRequestContext,
  token: string,
  eventCode: string
): Promise<void> {
  await saveQualificationAllianceScoreApi(request, token, eventCode, {
    alliance: "red",
  });
  await saveQualificationAllianceScoreApi(request, token, eventCode, {
    alliance: "blue",
  });
}

export async function createProvisionedEvent(
  request: APIRequestContext,
  options: ProvisionEventOptions = {}
): Promise<{
  eventCode: string;
  eventName: string;
  teams: TeamSeed[];
  token: string;
}> {
  const token = options.token ?? (await loginAsAdminApi(request));
  const { eventCode, eventName } = await createManualEventApi(
    request,
    token,
    options
  );

  const teams =
    options.teamCount && options.teamCount > 0
      ? await seedTeamsApi(request, token, eventCode, options.teamCount)
      : [];

  if (options.generateQualificationSchedule) {
    await generateQualificationScheduleApi(
      request,
      token,
      eventCode,
      options.qualificationMatchesPerTeam ?? 4
    );
  }

  return {
    eventCode,
    eventName,
    teams,
    token,
  };
}
