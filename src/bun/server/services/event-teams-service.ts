import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { DATA_DIR, db, schema } from "../../db";
import { ServiceError } from "./manual-event-service";

export interface EventTeamItem {
  advancement: number;
  city: string;
  country: string;
  division: number;
  organizationSchool: string;
  teamName: string;
  teamNumber: number;
}

export interface EventTeamsResponse {
  eventCode: string;
  teams: EventTeamItem[];
}

export interface AddEventTeamInput {
  city?: string;
  country?: string;
  organizationSchool?: string;
  teamName: string;
  teamNumber: number;
}

export interface UpdateEventTeamInput {
  city?: string;
  country?: string;
  organizationSchool?: string;
  teamName: string;
}

interface TeamsRow {
  advancement: number;
  division: number;
  teamNumber: number;
}

interface TeamLegacyRow {
  city: string;
  country: string;
  organizationSchool: string | null;
  teamNameLong: string | null;
  teamNameShort: string;
  teamNumber: number;
}

interface TeamMetadataRow {
  city: string;
  country: string;
  organizationSchool: string;
  teamName: string;
  teamNumber: number;
}

const MAX_TEAM_NUMBER = 99_999;
const DEFAULT_TEAM_ADVANCEMENT = 0;
const DEFAULT_TEAM_DIVISION = 1;
const DEFAULT_INSPIRE_ELIGIBLE = 1;
const DEFAULT_PROMOTE_ELIGIBLE = 1;
const DEFAULT_COMPETING = "Y";

const tableExists = (eventDb: Database, tableName: string): boolean => {
  const row = eventDb
    .query(
      "SELECT 1 AS has_table FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1"
    )
    .get(tableName) as { has_table: number } | null;
  return Boolean(row?.has_table);
};

const ensureTeamsTable = (eventDb: Database): void => {
  eventDb.exec(`CREATE TABLE IF NOT EXISTS teams (
    number INTEGER NOT NULL PRIMARY KEY,
    advancement INTEGER NOT NULL,
    division INTEGER NOT NULL,
    inspire_eligible INTEGER NOT NULL,
    promote_eligible INTEGER NOT NULL,
    competing TEXT NOT NULL
  )`);
};

const ensureTeamMetadataTable = (eventDb: Database): void => {
  eventDb.exec(`CREATE TABLE IF NOT EXISTS team_metadata (
    team_number INTEGER NOT NULL PRIMARY KEY,
    team_name TEXT NOT NULL DEFAULT '',
    organization_school TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL
  )`);

  const columns = getTableColumns(eventDb, "team_metadata");
  const requiredColumns: [name: string, definition: string][] = [
    ["team_name", "TEXT NOT NULL DEFAULT ''"],
    ["organization_school", "TEXT NOT NULL DEFAULT ''"],
    ["city", "TEXT NOT NULL DEFAULT ''"],
    ["country", "TEXT NOT NULL DEFAULT ''"],
    ["updated_at", "INTEGER NOT NULL DEFAULT 0"],
  ];

  for (const [columnName, definition] of requiredColumns) {
    if (columns.has(columnName)) {
      continue;
    }
    eventDb.exec(
      `ALTER TABLE team_metadata ADD COLUMN ${columnName} ${definition}`
    );
  }
};

const assertEventExists = (eventCode: string): void => {
  const [eventRow] = db
    .select({ code: schema.events.code })
    .from(schema.events)
    .where(eq(schema.events.code, eventCode))
    .limit(1)
    .all();

  if (!eventRow) {
    throw new ServiceError(`Event "${eventCode}" was not found.`, 404);
  }
};

const withEventDb = <T>(
  eventCode: string,
  operation: (eventDb: Database) => T
): T => {
  const eventDbPath = join(DATA_DIR, `${eventCode}.db`);

  if (!existsSync(eventDbPath)) {
    throw new ServiceError(
      `Database file for event "${eventCode}" was not found.`,
      404
    );
  }

  const eventDb = new Database(eventDbPath);

  try {
    return operation(eventDb);
  } finally {
    eventDb.close();
  }
};

const normalizeSearch = (search: string | undefined): string =>
  search?.trim().toLowerCase() ?? "";

const toSearchableText = (team: EventTeamItem): string =>
  [
    team.teamNumber,
    team.teamName,
    team.organizationSchool,
    team.city,
    team.country,
  ]
    .join(" ")
    .toLowerCase();

const getTableColumns = (eventDb: Database, tableName: string): Set<string> => {
  if (!tableExists(eventDb, tableName)) {
    return new Set<string>();
  }

  const rows = eventDb.query(`PRAGMA table_info(${tableName})`).all() as Array<{
    name: string;
  }>;

  const columns = new Set<string>();
  for (const row of rows) {
    columns.add(row.name);
  }

  return columns;
};

const loadMetadataRows = (eventDb: Database): TeamMetadataRow[] => {
  if (!tableExists(eventDb, "team_metadata")) {
    return [];
  }

  const columns = getTableColumns(eventDb, "team_metadata");
  let teamNameExpression = "''";
  if (columns.has("team_name")) {
    teamNameExpression = "team_name";
  } else if (columns.has("short_name")) {
    teamNameExpression = "short_name";
  }
  const organizationSchoolExpression = columns.has("organization_school")
    ? "organization_school"
    : "''";
  const cityExpression = columns.has("city") ? "city" : "''";
  const countryExpression = columns.has("country") ? "country" : "''";

  return eventDb
    .query(
      `SELECT team_number AS teamNumber, ${teamNameExpression} AS teamName, ${organizationSchoolExpression} AS organizationSchool, ${cityExpression} AS city, ${countryExpression} AS country FROM team_metadata ORDER BY team_number ASC`
    )
    .all() as TeamMetadataRow[];
};

const upsertTeamMetadata = (
  eventDb: Database,
  input: AddEventTeamInput
): void => {
  const columns = getTableColumns(eventDb, "team_metadata");
  const now = Date.now();

  const insertColumns = ["team_number"];
  const insertValues: Array<number | string> = [input.teamNumber];
  const updateAssignments: string[] = [];

  if (columns.has("team_name")) {
    insertColumns.push("team_name");
    insertValues.push(input.teamName.trim());
    updateAssignments.push("team_name = excluded.team_name");
  }

  if (columns.has("short_name")) {
    insertColumns.push("short_name");
    insertValues.push(input.teamName.trim());
    updateAssignments.push("short_name = excluded.short_name");
  }

  if (columns.has("organization_school")) {
    insertColumns.push("organization_school");
    insertValues.push(input.organizationSchool?.trim() ?? "");
    updateAssignments.push(
      "organization_school = excluded.organization_school"
    );
  }

  if (columns.has("city")) {
    insertColumns.push("city");
    insertValues.push(input.city?.trim() ?? "");
    updateAssignments.push("city = excluded.city");
  }

  if (columns.has("country")) {
    insertColumns.push("country");
    insertValues.push(input.country?.trim() ?? "");
    updateAssignments.push("country = excluded.country");
  }

  if (columns.has("updated_at")) {
    insertColumns.push("updated_at");
    insertValues.push(now);
    updateAssignments.push("updated_at = excluded.updated_at");
  }

  const placeholders = insertColumns.map(() => "?").join(", ");
  const updateSql =
    updateAssignments.length > 0
      ? updateAssignments.join(", ")
      : "team_number = excluded.team_number";

  eventDb
    .query(
      `INSERT INTO team_metadata (${insertColumns.join(", ")}) VALUES (${placeholders}) ON CONFLICT(team_number) DO UPDATE SET ${updateSql}`
    )
    .run(...insertValues);
};

const loadTeams = (eventDb: Database): EventTeamItem[] => {
  const teamsRows = tableExists(eventDb, "teams")
    ? (eventDb
        .query(
          "SELECT number AS teamNumber, advancement AS advancement, division AS division FROM teams ORDER BY number ASC"
        )
        .all() as TeamsRow[])
    : [];

  const metadataRows = tableExists(eventDb, "team_metadata")
    ? loadMetadataRows(eventDb)
    : [];

  const legacyRows = tableExists(eventDb, "team")
    ? (eventDb
        .query(
          "SELECT team_number AS teamNumber, team_name_short AS teamNameShort, team_name_long AS teamNameLong, school_name AS organizationSchool, city AS city, country AS country FROM team ORDER BY team_number ASC"
        )
        .all() as TeamLegacyRow[])
    : [];

  const teamsByNumber = new Map<number, TeamsRow>();
  for (const row of teamsRows) {
    teamsByNumber.set(row.teamNumber, row);
  }

  const metadataByNumber = new Map<number, TeamMetadataRow>();
  for (const row of metadataRows) {
    metadataByNumber.set(row.teamNumber, row);
  }

  const legacyByNumber = new Map<number, TeamLegacyRow>();
  for (const row of legacyRows) {
    legacyByNumber.set(row.teamNumber, row);
  }

  const teamNumbers = new Set<number>();
  for (const teamNumber of teamsByNumber.keys()) {
    teamNumbers.add(teamNumber);
  }
  for (const teamNumber of metadataByNumber.keys()) {
    teamNumbers.add(teamNumber);
  }
  for (const teamNumber of legacyByNumber.keys()) {
    teamNumbers.add(teamNumber);
  }

  const sortedTeamNumbers = Array.from(teamNumbers).sort((a, b) => a - b);
  const teams: EventTeamItem[] = [];

  for (const teamNumber of sortedTeamNumbers) {
    const teamRow = teamsByNumber.get(teamNumber);
    const metadataRow = metadataByNumber.get(teamNumber);
    const legacyRow = legacyByNumber.get(teamNumber);

    teams.push({
      teamNumber,
      teamName:
        metadataRow?.teamName.trim() ||
        legacyRow?.teamNameLong?.trim() ||
        legacyRow?.teamNameShort.trim() ||
        `Team ${teamNumber}`,
      organizationSchool:
        metadataRow?.organizationSchool.trim() ||
        legacyRow?.organizationSchool?.trim() ||
        "",
      city: metadataRow?.city.trim() || legacyRow?.city.trim() || "",
      country: metadataRow?.country.trim() || legacyRow?.country.trim() || "",
      advancement: teamRow?.advancement ?? 0,
      division: teamRow?.division ?? 1,
    });
  }

  return teams;
};

const assertValidTeamNumber = (teamNumber: number): void => {
  if (
    !Number.isInteger(teamNumber) ||
    teamNumber <= 0 ||
    teamNumber > MAX_TEAM_NUMBER
  ) {
    throw new ServiceError(
      `Team number must be an integer between 1 and ${MAX_TEAM_NUMBER}.`,
      400
    );
  }
};

const eventDbHasTeam = (eventDb: Database, teamNumber: number): boolean => {
  const hasTeamsRow =
    tableExists(eventDb, "teams") &&
    Boolean(
      eventDb
        .query("SELECT 1 AS found FROM teams WHERE number = ? LIMIT 1")
        .get(teamNumber)
    );
  if (hasTeamsRow) {
    return true;
  }

  const hasMetadataRow =
    tableExists(eventDb, "team_metadata") &&
    Boolean(
      eventDb
        .query(
          "SELECT 1 AS found FROM team_metadata WHERE team_number = ? LIMIT 1"
        )
        .get(teamNumber)
    );
  if (hasMetadataRow) {
    return true;
  }

  const hasLegacyRow =
    tableExists(eventDb, "team") &&
    Boolean(
      eventDb
        .query("SELECT 1 AS found FROM team WHERE team_number = ? LIMIT 1")
        .get(teamNumber)
    );

  return hasLegacyRow;
};

export function listEventTeams(
  eventCode: string,
  search: string | undefined
): EventTeamsResponse {
  assertEventExists(eventCode);

  const normalizedSearch = normalizeSearch(search);
  const teams = withEventDb(eventCode, (eventDb) => loadTeams(eventDb)).filter(
    (team) =>
      normalizedSearch.length === 0 ||
      toSearchableText(team).includes(normalizedSearch)
  );

  return {
    eventCode,
    teams,
  };
}

export function addEventTeam(
  eventCode: string,
  input: AddEventTeamInput
): EventTeamItem {
  assertEventExists(eventCode);
  assertValidTeamNumber(input.teamNumber);

  const teamName = input.teamName.trim();
  if (!teamName) {
    throw new ServiceError("Team name is required.", 400);
  }

  withEventDb(eventCode, (eventDb) => {
    ensureTeamsTable(eventDb);
    ensureTeamMetadataTable(eventDb);

    eventDb.exec("BEGIN TRANSACTION");
    try {
      eventDb
        .query(
          "INSERT INTO teams (number, advancement, division, inspire_eligible, promote_eligible, competing) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(number) DO NOTHING"
        )
        .run(
          input.teamNumber,
          DEFAULT_TEAM_ADVANCEMENT,
          DEFAULT_TEAM_DIVISION,
          DEFAULT_INSPIRE_ELIGIBLE,
          DEFAULT_PROMOTE_ELIGIBLE,
          DEFAULT_COMPETING
        );

      upsertTeamMetadata(eventDb, input);
      eventDb.exec("COMMIT");
    } catch (error) {
      eventDb.exec("ROLLBACK");
      throw error;
    }
  });

  const result = listEventTeams(eventCode, String(input.teamNumber));
  const team = result.teams.find(
    (item) => item.teamNumber === input.teamNumber
  );

  if (!team) {
    throw new ServiceError("Failed to load saved team.", 500);
  }

  return team;
}

export function updateEventTeam(
  eventCode: string,
  teamNumber: number,
  input: UpdateEventTeamInput
): EventTeamItem {
  assertEventExists(eventCode);
  assertValidTeamNumber(teamNumber);

  const teamName = input.teamName.trim();
  if (!teamName) {
    throw new ServiceError("Team name is required.", 400);
  }

  withEventDb(eventCode, (eventDb) => {
    if (!eventDbHasTeam(eventDb, teamNumber)) {
      throw new ServiceError(
        `Team ${teamNumber} was not found for event "${eventCode}".`,
        404
      );
    }

    ensureTeamMetadataTable(eventDb);
    upsertTeamMetadata(eventDb, {
      teamNumber,
      teamName,
      organizationSchool: input.organizationSchool,
      city: input.city,
      country: input.country,
    });
  });

  const updatedTeam = listEventTeams(eventCode, String(teamNumber)).teams.find(
    (item) => item.teamNumber === teamNumber
  );
  if (!updatedTeam) {
    throw new ServiceError("Failed to load updated team.", 500);
  }

  return updatedTeam;
}

export function deleteEventTeam(eventCode: string, teamNumber: number): void {
  assertEventExists(eventCode);
  assertValidTeamNumber(teamNumber);

  withEventDb(eventCode, (eventDb) => {
    if (!eventDbHasTeam(eventDb, teamNumber)) {
      throw new ServiceError(
        `Team ${teamNumber} was not found for event "${eventCode}".`,
        404
      );
    }

    eventDb.exec("BEGIN TRANSACTION");
    try {
      if (tableExists(eventDb, "teams")) {
        eventDb.query("DELETE FROM teams WHERE number = ?").run(teamNumber);
      }

      if (tableExists(eventDb, "team_metadata")) {
        eventDb
          .query("DELETE FROM team_metadata WHERE team_number = ?")
          .run(teamNumber);
      }

      if (tableExists(eventDb, "team")) {
        eventDb.query("DELETE FROM team WHERE team_number = ?").run(teamNumber);
      }

      eventDb.exec("COMMIT");
    } catch (error) {
      eventDb.exec("ROLLBACK");
      throw error;
    }
  });

  const stillExists = listEventTeams(eventCode, String(teamNumber)).teams.some(
    (team) => team.teamNumber === teamNumber
  );
  if (stillExists) {
    throw new ServiceError("Failed to delete team.", 500);
  }
}
