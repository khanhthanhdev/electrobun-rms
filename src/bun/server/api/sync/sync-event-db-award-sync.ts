import type { Database } from "bun:sqlite";
import { SYNC_SEASON } from "./sync.schema";
import {
  buildSyntheticFmsTeamId,
  getExistingEventId,
  parsePositiveInteger,
  toBooleanInt,
} from "./sync-event-db-shared";
import type {
  EventTeamDirectoryEntry,
  SyncRecord,
} from "./sync-event-db-types";

export const applyTeamAwardsSnapshot = (
  eventDb: Database,
  eventCode: string,
  teamDirectory: EventTeamDirectoryEntry[],
  records: SyncRecord[]
): void => {
  const fmsEventId = getExistingEventId(eventDb) || eventCode;
  const teamIdByNumber = new Map(
    teamDirectory.map((team) => [team.teamNumber, team.fmsTeamId])
  );

  eventDb.query("DELETE FROM award_assignment").run();
  eventDb.query("DELETE FROM award").run();

  const awardInsert = eventDb.query(
    `INSERT INTO award (
      fms_award_id,
      fms_season_id,
      award_id,
      award_subtype_id,
      tournament_type,
      type,
      culture_type,
      description,
      default_quantity,
      sponsor_details,
      display_order_ui,
      display_order_online,
      cmp_qualifying,
      allow_manual_entry,
      created_on,
      created_by,
      modified_on,
      modified_by,
      script,
      can_edit
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const assignmentInsert = eventDb.query(
    `INSERT INTO award_assignment (
      fms_award_id,
      fms_event_id,
      series,
      fms_team_id,
      first_name,
      last_name,
      is_public,
      created_on,
      created_by,
      modified_on,
      modified_by,
      comment
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const awardCode = String(record.awardCode);
    const displayOrder = parsePositiveInteger(record.displayOrder, index + 1);
    const timestamp =
      typeof record.assignedAt === "string"
        ? record.assignedAt
        : new Date().toISOString();
    const awardId = `SYNC_AWARD_${awardCode}`;

    awardInsert.run(
      awardId,
      SYNC_SEASON,
      displayOrder,
      0,
      0,
      0,
      0,
      String(record.awardName),
      null,
      null,
      displayOrder,
      displayOrder,
      0,
      1,
      timestamp,
      "sync-api",
      timestamp,
      "sync-api",
      "",
      1
    );

    assignmentInsert.run(
      awardId,
      fmsEventId,
      1,
      typeof record.teamNumber === "string"
        ? teamIdByNumber.get(record.teamNumber) ||
            buildSyntheticFmsTeamId(record.teamNumber)
        : null,
      typeof record.recipient === "string" ? record.recipient : null,
      null,
      toBooleanInt(record.isPublic),
      timestamp,
      "sync-api",
      timestamp,
      "sync-api",
      typeof record.comment === "string" ? record.comment : null
    );
  }
};
