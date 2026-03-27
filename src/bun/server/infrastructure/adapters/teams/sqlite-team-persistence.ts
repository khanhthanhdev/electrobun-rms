import type { Database } from "bun:sqlite";
import { ApplicationError } from "../../../application/common/application-error";
import type {
  CreateTeamInput,
  SeedTeamInput,
  UpdateTeamInput,
} from "../../../application/dtos/teams";
import { hasTeamInEventDb } from "./sqlite-team-loaders";
import {
  assertValidTeamNumber,
  DEFAULT_COMPETING,
  DEFAULT_INSPIRE_ELIGIBLE,
  DEFAULT_PROMOTE_ELIGIBLE,
  DEFAULT_TEAM_ADVANCEMENT,
  DEFAULT_TEAM_DIVISION,
  ensureTeamMetadataTable,
  ensureTeamsTable,
  getTableColumns,
  tableExists,
} from "./sqlite-team-shared";

type TeamMetadataWriteInput = UpdateTeamInput & { teamNumber: number };

const normalizeRequiredTeamName = (teamName: string): string => {
  const normalizedTeamName = teamName.trim();
  if (!normalizedTeamName) {
    throw new ApplicationError("Team name is required.", 400);
  }

  return normalizedTeamName;
};

const upsertTeamMetadata = (
  eventDb: Database,
  input: TeamMetadataWriteInput
): void => {
  const columns = getTableColumns(eventDb, "team_metadata");
  const now = Date.now();
  const insertColumns = ["team_number"];
  const insertValues: Array<number | string> = [input.teamNumber];
  const updateAssignments: string[] = [];

  if (columns.has("team_name")) {
    insertColumns.push("team_name");
    insertValues.push(input.teamName);
    updateAssignments.push("team_name = excluded.team_name");
  }
  if (columns.has("short_name")) {
    insertColumns.push("short_name");
    insertValues.push(input.teamName);
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

  eventDb
    .query(
      `INSERT INTO team_metadata (${insertColumns.join(", ")})
       VALUES (${insertColumns.map(() => "?").join(", ")})
       ON CONFLICT(team_number) DO UPDATE SET ${updateAssignments.join(", ") || "team_number = excluded.team_number"}`
    )
    .run(...insertValues);
};

export const createTeamInEventDb = (
  eventDb: Database,
  input: CreateTeamInput
): void => {
  assertValidTeamNumber(input.teamNumber);
  const teamName = normalizeRequiredTeamName(input.teamName);

  ensureTeamsTable(eventDb);
  ensureTeamMetadataTable(eventDb);

  eventDb.exec("BEGIN TRANSACTION");
  try {
    eventDb
      .query(
        `INSERT INTO teams (
          number,
          advancement,
          division,
          inspire_eligible,
          promote_eligible,
          competing
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(number) DO NOTHING`
      )
      .run(
        input.teamNumber,
        DEFAULT_TEAM_ADVANCEMENT,
        DEFAULT_TEAM_DIVISION,
        DEFAULT_INSPIRE_ELIGIBLE,
        DEFAULT_PROMOTE_ELIGIBLE,
        DEFAULT_COMPETING
      );

    upsertTeamMetadata(eventDb, { ...input, teamName });
    eventDb.exec("COMMIT");
  } catch (error) {
    eventDb.exec("ROLLBACK");
    throw error;
  }
};

export const seedTeamsInEventDb = (
  eventDb: Database,
  inputs: SeedTeamInput[]
): void => {
  ensureTeamsTable(eventDb);
  ensureTeamMetadataTable(eventDb);

  eventDb.exec("BEGIN TRANSACTION");
  try {
    for (const input of inputs) {
      assertValidTeamNumber(input.teamNumber);
      const teamName = normalizeRequiredTeamName(input.teamName);

      eventDb
        .query(
          `INSERT INTO teams (
            number,
            advancement,
            division,
            inspire_eligible,
            promote_eligible,
            competing
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(number) DO NOTHING`
        )
        .run(
          input.teamNumber,
          DEFAULT_TEAM_ADVANCEMENT,
          DEFAULT_TEAM_DIVISION,
          DEFAULT_INSPIRE_ELIGIBLE,
          DEFAULT_PROMOTE_ELIGIBLE,
          DEFAULT_COMPETING
        );

      upsertTeamMetadata(eventDb, { ...input, teamName });
    }

    eventDb.exec("COMMIT");
  } catch (error) {
    eventDb.exec("ROLLBACK");
    throw error;
  }
};

export const updateTeamInEventDb = (
  eventDb: Database,
  eventCode: string,
  teamNumber: number,
  input: UpdateTeamInput
): void => {
  assertValidTeamNumber(teamNumber);
  if (!hasTeamInEventDb(eventDb, teamNumber)) {
    throw new ApplicationError(
      `Team ${teamNumber} was not found for event "${eventCode}".`,
      404
    );
  }

  ensureTeamMetadataTable(eventDb);
  upsertTeamMetadata(eventDb, {
    ...input,
    teamNumber,
    teamName: normalizeRequiredTeamName(input.teamName),
  });
};

export const deleteTeamInEventDb = (
  eventDb: Database,
  eventCode: string,
  teamNumber: number
): void => {
  assertValidTeamNumber(teamNumber);
  if (!hasTeamInEventDb(eventDb, teamNumber)) {
    throw new ApplicationError(
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
};
