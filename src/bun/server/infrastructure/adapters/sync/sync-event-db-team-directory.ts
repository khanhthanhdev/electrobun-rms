import type { Database } from "bun:sqlite";
import {
  buildSyntheticFmsTeamId,
  tableExists,
  withEventDb,
} from "./sync-event-db-shared";
import type { EventTeamDirectoryEntry } from "./sync-event-db-types";

export const loadEventTeamDirectoryFromDb = (
  eventDb: Database
): EventTeamDirectoryEntry[] => {
  const teamsByNumber = new Map<string, EventTeamDirectoryEntry>();

  const seedLegacyTeams = (): void => {
    if (!tableExists(eventDb, "team")) {
      return;
    }

    const rows = eventDb
      .query(
        `SELECT
          team_number AS teamNumber,
          fms_team_id AS fmsTeamId,
          COALESCE(NULLIF(team_name_long, ''), team_name_short, '') AS teamName,
          COALESCE(school_name, '') AS organizationName,
          COALESCE(city, '') AS city,
          COALESCE(country, '') AS country
         FROM team
         ORDER BY team_number ASC`
      )
      .all() as Array<{
      city: string;
      country: string;
      fmsTeamId: string | null;
      organizationName: string;
      teamName: string;
      teamNumber: number;
    }>;

    for (const row of rows) {
      const teamNumber = String(row.teamNumber);
      teamsByNumber.set(teamNumber, {
        city: row.city || undefined,
        country: row.country || undefined,
        fmsTeamId: row.fmsTeamId?.trim() || buildSyntheticFmsTeamId(teamNumber),
        organizationName: row.organizationName || "",
        teamName: row.teamName || `Team ${teamNumber}`,
        teamNumber,
      });
    }
  };

  const seedMetadataTeams = (): void => {
    if (!tableExists(eventDb, "team_metadata")) {
      return;
    }

    const rows = eventDb
      .query(
        `SELECT
          team_number AS teamNumber,
          COALESCE(team_name, '') AS teamName,
          COALESCE(organization_school, '') AS organizationName,
          COALESCE(city, '') AS city,
          COALESCE(country, '') AS country
         FROM team_metadata
         ORDER BY team_number ASC`
      )
      .all() as Array<{
      city: string;
      country: string;
      organizationName: string;
      teamName: string;
      teamNumber: number;
    }>;

    for (const row of rows) {
      const teamNumber = String(row.teamNumber);
      const existing = teamsByNumber.get(teamNumber);
      teamsByNumber.set(teamNumber, {
        city: row.city || existing?.city,
        country: row.country || existing?.country,
        fmsTeamId: existing?.fmsTeamId || buildSyntheticFmsTeamId(teamNumber),
        organizationName:
          row.organizationName || existing?.organizationName || "",
        teamName: row.teamName || existing?.teamName || `Team ${teamNumber}`,
        teamNumber,
      });
    }
  };

  const seedModernTeams = (): void => {
    if (!tableExists(eventDb, "teams")) {
      return;
    }

    const rows = eventDb
      .query("SELECT number AS teamNumber FROM teams ORDER BY number ASC")
      .all() as Array<{ teamNumber: number }>;

    for (const row of rows) {
      const teamNumber = String(row.teamNumber);
      const existing = teamsByNumber.get(teamNumber);
      teamsByNumber.set(teamNumber, {
        city: existing?.city,
        country: existing?.country,
        fmsTeamId: existing?.fmsTeamId || buildSyntheticFmsTeamId(teamNumber),
        organizationName: existing?.organizationName || "",
        teamName: existing?.teamName || `Team ${teamNumber}`,
        teamNumber,
      });
    }
  };

  seedLegacyTeams();
  seedMetadataTeams();
  seedModernTeams();

  return Array.from(teamsByNumber.values()).sort(
    (left, right) => Number(left.teamNumber) - Number(right.teamNumber)
  );
};

export const loadEventTeamDirectory = (
  eventCode: string
): EventTeamDirectoryEntry[] =>
  withEventDb(eventCode, (eventDb) => loadEventTeamDirectoryFromDb(eventDb));
