import type { Database } from "bun:sqlite";
import {
  clearScheduleTables,
  resolveMatchStorage,
  writeMatchLineupAndData,
} from "./sync-event-db-match-persistence";
import {
  inferCycleTime,
  resolveAllianceTeams,
  resolveMatchStatus,
  resolveMatchType,
} from "./sync-event-db-match-shared";
import {
  DEFAULT_MATCH_CYCLE_MS,
  DEFAULT_MATCH_DURATION_MS,
  parsePositiveInteger,
  parseTimestamp,
} from "./sync-event-db-shared";
import type {
  MatchLineup,
  MatchPhase,
  MatchType,
  SyncRecord,
} from "./sync-event-db-types";

const insertMatchSchedule = (
  eventDb: Database,
  matchType: MatchType,
  matches: MatchLineup[]
): void => {
  const cycleTime = inferCycleTime(matches);
  const storage = resolveMatchStorage(matchType);

  for (const match of matches) {
    writeMatchLineupAndData(eventDb, matchType, match);
  }

  if (
    storage.scheduleTable &&
    storage.blockTable &&
    storage.scheduleLabel &&
    storage.scheduleType &&
    storage.blockType
  ) {
    const start = matches[0]?.scheduledAt ?? 0;
    const end = (matches.at(-1)?.scheduledAt ?? 0) + DEFAULT_MATCH_DURATION_MS;

    eventDb
      .query(
        `INSERT INTO ${storage.scheduleTable} (start, end, type, label) VALUES (?, ?, ?, ?)`
      )
      .run(start, end, storage.scheduleType, storage.scheduleLabel);
    eventDb
      .query(
        `INSERT INTO ${storage.blockTable} (start, end, type, cycle_time, label) VALUES (?, ?, ?, ?, ?)`
      )
      .run(start, end, storage.blockType, cycleTime, storage.scheduleLabel);
  }
};

export const applyMatchScheduleSnapshot = (
  eventDb: Database,
  records: SyncRecord[]
): void => {
  clearScheduleTables(eventDb);

  const grouped = new Map<MatchType, MatchLineup[]>();
  const now = Date.now();
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const phase = String(record.phase ?? "QUALIFICATION") as MatchPhase;
    const matchType = resolveMatchType(phase);
    const groupedMatches = grouped.get(matchType) ?? [];
    const { blueTeam, redTeam } = resolveAllianceTeams(record);

    groupedMatches.push({
      blueTeam,
      matchNumber: parsePositiveInteger(record.matchNumber, index + 1),
      redTeam,
      scheduledAt: parseTimestamp(
        record.scheduledAt,
        now + index * DEFAULT_MATCH_CYCLE_MS
      ),
      status: resolveMatchStatus(record.status),
    });
    grouped.set(matchType, groupedMatches);
  }

  for (const [matchType, matches] of grouped.entries()) {
    matches.sort((left, right) => left.matchNumber - right.matchNumber);
    insertMatchSchedule(eventDb, matchType, matches);
  }

  if (grouped.has("quals")) {
    eventDb
      .query(
        "INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      )
      .run("active_schedule_type", "quals");
    return;
  }

  if (grouped.has("practice")) {
    eventDb
      .query(
        "INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      )
      .run("active_schedule_type", "practice");
    return;
  }

  eventDb.query("DELETE FROM config WHERE key = ?").run("active_schedule_type");
};
