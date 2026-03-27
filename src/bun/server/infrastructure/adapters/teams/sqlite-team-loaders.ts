import type { Database } from "bun:sqlite";
import type { TeamItem } from "../../../application/dtos/teams";
import { getTableColumns, tableExists } from "./sqlite-team-shared";

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

interface TeamsRow {
  advancement: number;
  division: number;
  teamNumber: number;
}

const loadMetadataRows = (eventDb: Database): TeamMetadataRow[] => {
  const columns = getTableColumns(eventDb, "team_metadata");
  let teamNameExpression = "''";
  if (columns.has("team_name")) {
    teamNameExpression = "team_name";
  } else if (columns.has("short_name")) {
    teamNameExpression = "short_name";
  }

  return eventDb
    .query(
      `SELECT
        team_number AS teamNumber,
        ${teamNameExpression} AS teamName,
        ${columns.has("organization_school") ? "organization_school" : "''"} AS organizationSchool,
        ${columns.has("city") ? "city" : "''"} AS city,
        ${columns.has("country") ? "country" : "''"} AS country
       FROM team_metadata
       ORDER BY team_number ASC`
    )
    .all() as TeamMetadataRow[];
};

export const hasTeamInEventDb = (
  eventDb: Database,
  teamNumber: number
): boolean => {
  const tableChecks: [tableName: string, columnName: string][] = [
    ["teams", "number"],
    ["team_metadata", "team_number"],
    ["team", "team_number"],
  ];

  for (const [tableName, columnName] of tableChecks) {
    if (!tableExists(eventDb, tableName)) {
      continue;
    }

    const row = eventDb
      .query(
        `SELECT 1 AS found FROM ${tableName} WHERE ${columnName} = ? LIMIT 1`
      )
      .get(teamNumber) as { found: number } | null;
    if (row?.found) {
      return true;
    }
  }

  return false;
};

export const loadTeamsFromEventDb = (eventDb: Database): TeamItem[] => {
  const teamRows = tableExists(eventDb, "teams")
    ? (eventDb
        .query(
          "SELECT number AS teamNumber, advancement, division FROM teams ORDER BY number ASC"
        )
        .all() as TeamsRow[])
    : [];
  const metadataRows = tableExists(eventDb, "team_metadata")
    ? loadMetadataRows(eventDb)
    : [];
  const legacyRows = tableExists(eventDb, "team")
    ? (eventDb
        .query(
          `SELECT
            team_number AS teamNumber,
            team_name_short AS teamNameShort,
            team_name_long AS teamNameLong,
            school_name AS organizationSchool,
            city,
            country
           FROM team
           ORDER BY team_number ASC`
        )
        .all() as TeamLegacyRow[])
    : [];

  const teamsByNumber = new Map(teamRows.map((row) => [row.teamNumber, row]));
  const metadataByNumber = new Map(
    metadataRows.map((row) => [row.teamNumber, row])
  );
  const legacyByNumber = new Map(
    legacyRows.map((row) => [row.teamNumber, row])
  );
  const teamNumbers = new Set<number>([
    ...teamsByNumber.keys(),
    ...metadataByNumber.keys(),
    ...legacyByNumber.keys(),
  ]);

  return Array.from(teamNumbers)
    .sort((left, right) => left - right)
    .map((teamNumber) => {
      const teamRow = teamsByNumber.get(teamNumber);
      const metadataRow = metadataByNumber.get(teamNumber);
      const legacyRow = legacyByNumber.get(teamNumber);

      return {
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
      };
    });
};
