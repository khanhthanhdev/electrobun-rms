import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { DATA_DIR, db, schema } from "../../../db";
import checklistConfig from "../../config/inspection-checklist.json";
import { ServiceError } from "../../services/manual-event-service";

type InspectionStatus = "NOT_STARTED" | "IN_PROGRESS" | "INCOMPLETE" | "PASSED";

const STATUS_LABELS: Record<InspectionStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  INCOMPLETE: "Incomplete",
  PASSED: "Passed",
};

const STATUS_CODES: Record<InspectionStatus, string> = {
  NOT_STARTED: "0",
  IN_PROGRESS: "1",
  INCOMPLETE: "2",
  PASSED: "3",
};

const VALID_STATUSES = new Set<string>([
  "NOT_STARTED",
  "IN_PROGRESS",
  "INCOMPLETE",
  "PASSED",
]);

interface TeamBasicRow {
  teamName: string;
  teamNumber: number;
}

interface InspectionRow {
  comment: string | null;
  finalizedAt: number | null;
  startedAt: number | null;
  status: string;
  teamNumber: number;
  updatedAt: number | null;
}

interface ResponseRow {
  itemKey: string;
  teamNumber: number;
  value: string | null;
}

interface InspectionTeamSummary {
  comment: string | null;
  progress: InspectionProgressResult;
  status: InspectionStatus;
  statusCode: string;
  statusLabel: string;
  teamName: string;
  teamNumber: number;
  updatedAt: string | null;
}

interface InspectionTeamsResult {
  eventCode: string;
  statusCounts: Record<InspectionStatus, number>;
  teams: InspectionTeamSummary[];
  totalTeams: number;
}

interface InspectionDetailResult {
  checklist: {
    items: typeof checklistConfig.items;
    sections: typeof checklistConfig.sections;
  };
  inspection: {
    comment: string | null;
    finalizedAt: string | null;
    id: string;
    startedAt: string | null;
    status: InspectionStatus;
    statusCode: string;
    statusLabel: string;
    updatedAt: string | null;
  };
  progress: InspectionProgressResult;
  responses: Record<string, string | null>;
  team: {
    teamName: string | null;
    teamNumber: number;
  };
}

interface InspectionHistoryRow {
  action: string;
  changedAt: number;
  changedBy: string;
  id: number;
  isOverride: number;
  newStatus: string | null;
  oldStatus: string | null;
  teamNumber: number;
}

interface InspectionHistoryEntry {
  action: string;
  changedAt: string;
  changedBy: string;
  id: number;
  isOverride: boolean;
  newStatus: string | null;
  oldStatus: string | null;
}

interface InspectionHistoryResult {
  history: InspectionHistoryEntry[];
  teamNumber: number;
}

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

const tableExists = (eventDb: Database, tableName: string): boolean => {
  const row = eventDb
    .query(
      "SELECT 1 AS has_table FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1"
    )
    .get(tableName) as { has_table: number } | null;
  return Boolean(row?.has_table);
};

const ensureInspectionTables = (eventDb: Database): void => {
  eventDb.exec(`CREATE TABLE IF NOT EXISTS inspections (
    team_number INTEGER NOT NULL PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'NOT_STARTED',
    comment TEXT,
    started_at INTEGER,
    finalized_at INTEGER,
    updated_at INTEGER
  )`);

  eventDb.exec(`CREATE TABLE IF NOT EXISTS inspection_responses (
    team_number INTEGER NOT NULL,
    item_key TEXT NOT NULL,
    value TEXT,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (team_number, item_key)
  )`);

  eventDb.exec(`CREATE TABLE IF NOT EXISTS inspection_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_number INTEGER NOT NULL,
    action TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT,
    is_override INTEGER NOT NULL DEFAULT 0,
    changed_by TEXT NOT NULL,
    changed_at INTEGER NOT NULL
  )`);
};

const loadTeamBasics = (eventDb: Database): TeamBasicRow[] => {
  if (tableExists(eventDb, "team_metadata")) {
    return eventDb
      .query(
        "SELECT tm.team_number AS teamNumber, COALESCE(NULLIF(tm.team_name, ''), 'Team ' || tm.team_number) AS teamName FROM team_metadata tm ORDER BY tm.team_number ASC"
      )
      .all() as TeamBasicRow[];
  }

  if (tableExists(eventDb, "teams")) {
    return eventDb
      .query(
        "SELECT number AS teamNumber, 'Team ' || number AS teamName FROM teams ORDER BY number ASC"
      )
      .all() as TeamBasicRow[];
  }

  return [];
};

const loadInspectionRows = (eventDb: Database): InspectionRow[] => {
  if (!tableExists(eventDb, "inspections")) {
    return [];
  }

  return eventDb
    .query(
      "SELECT team_number AS teamNumber, status, comment, started_at AS startedAt, finalized_at AS finalizedAt, updated_at AS updatedAt FROM inspections"
    )
    .all() as InspectionRow[];
};

const loadResponseRows = (eventDb: Database): ResponseRow[] => {
  if (!tableExists(eventDb, "inspection_responses")) {
    return [];
  }

  return eventDb
    .query(
      "SELECT team_number AS teamNumber, item_key AS itemKey, value FROM inspection_responses"
    )
    .all() as ResponseRow[];
};

const getRequiredItemKeys = (): Set<string> => {
  const keys = new Set<string>();
  for (const item of checklistConfig.items) {
    if (item.required) {
      keys.add(item.key);
    }
  }
  return keys;
};

interface InspectionProgressResult {
  completedRequired: number;
  missingRequired: number;
  totalRequired: number;
}

const calculateProgress = (
  teamResponses: Map<string, string | null>,
  requiredKeys: Set<string>
): InspectionProgressResult => {
  const totalRequired = requiredKeys.size;
  let completedRequired = 0;
  for (const key of requiredKeys) {
    const value = teamResponses.get(key);
    if (value !== undefined && value !== null && value !== "") {
      completedRequired++;
    }
  }
  return {
    completedRequired,
    missingRequired: totalRequired - completedRequired,
    totalRequired,
  };
};

const toStatus = (raw: string | undefined): InspectionStatus => {
  if (raw && VALID_STATUSES.has(raw)) {
    return raw as InspectionStatus;
  }
  return "NOT_STARTED";
};

const recordHistory = (
  eventDb: Database,
  teamNumber: number,
  action: string,
  oldStatus: string | null,
  newStatus: string | null,
  changedBy: string,
  isOverride: boolean
): void => {
  const now = Date.now();
  eventDb
    .query(
      "INSERT INTO inspection_history (team_number, action, old_status, new_status, is_override, changed_by, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      teamNumber,
      action,
      oldStatus,
      newStatus,
      isOverride ? 1 : 0,
      changedBy,
      now
    );
};

export function getChecklist() {
  return {
    sections: checklistConfig.sections,
    items: checklistConfig.items,
  };
}

export function listInspectionTeams(
  eventCode: string,
  search?: string
): InspectionTeamsResult {
  assertEventExists(eventCode);

  const result = withEventDb(eventCode, (eventDb) => {
    ensureInspectionTables(eventDb);

    const teamBasics = loadTeamBasics(eventDb);
    const inspectionRows = loadInspectionRows(eventDb);
    const responseRows = loadResponseRows(eventDb);

    const inspectionByTeam = new Map<number, InspectionRow>();
    for (const row of inspectionRows) {
      inspectionByTeam.set(row.teamNumber, row);
    }

    const responsesByTeam = new Map<number, Map<string, string | null>>();
    for (const row of responseRows) {
      let teamMap = responsesByTeam.get(row.teamNumber);
      if (!teamMap) {
        teamMap = new Map<string, string | null>();
        responsesByTeam.set(row.teamNumber, teamMap);
      }
      teamMap.set(row.itemKey, row.value);
    }

    const requiredKeys = getRequiredItemKeys();

    const teams: InspectionTeamSummary[] = [];
    for (const team of teamBasics) {
      const inspection = inspectionByTeam.get(team.teamNumber);
      const teamResponses =
        responsesByTeam.get(team.teamNumber) ??
        new Map<string, string | null>();
      const status = toStatus(inspection?.status);
      const progress = calculateProgress(teamResponses, requiredKeys);

      teams.push({
        teamNumber: team.teamNumber,
        teamName: team.teamName,
        status,
        statusCode: STATUS_CODES[status],
        statusLabel: STATUS_LABELS[status],
        progress,
        comment: inspection?.comment ?? null,
        updatedAt: inspection?.updatedAt
          ? new Date(inspection.updatedAt).toISOString()
          : null,
      });
    }

    return teams;
  });

  const normalizedSearch = search?.trim().toLowerCase() ?? "";
  const filtered =
    normalizedSearch.length === 0
      ? result
      : result.filter((team) =>
          `${team.teamNumber} ${team.teamName}`
            .toLowerCase()
            .includes(normalizedSearch)
        );

  const statusCounts: Record<InspectionStatus, number> = {
    NOT_STARTED: 0,
    IN_PROGRESS: 0,
    INCOMPLETE: 0,
    PASSED: 0,
  };
  for (const team of filtered) {
    statusCounts[team.status]++;
  }

  return {
    eventCode,
    teams: filtered,
    statusCounts,
    totalTeams: result.length,
  };
}

export function getInspectionDetail(
  eventCode: string,
  teamNumber: number
): InspectionDetailResult {
  assertEventExists(eventCode);

  return withEventDb(eventCode, (eventDb) => {
    ensureInspectionTables(eventDb);

    eventDb
      .query(
        "INSERT OR IGNORE INTO inspections (team_number, status) VALUES (?, 'NOT_STARTED')"
      )
      .run(teamNumber);

    const inspectionRow = eventDb
      .query(
        "SELECT team_number AS teamNumber, status, comment, started_at AS startedAt, finalized_at AS finalizedAt, updated_at AS updatedAt FROM inspections WHERE team_number = ?"
      )
      .get(teamNumber) as InspectionRow | null;

    if (!inspectionRow) {
      throw new ServiceError(
        `Inspection record for team ${teamNumber} was not found.`,
        404
      );
    }

    const responseRows = eventDb
      .query(
        "SELECT item_key AS itemKey, value FROM inspection_responses WHERE team_number = ?"
      )
      .all(teamNumber) as Array<{ itemKey: string; value: string | null }>;

    const responses: Record<string, string | null> = {};
    const teamResponses = new Map<string, string | null>();
    for (const row of responseRows) {
      responses[row.itemKey] = row.value;
      teamResponses.set(row.itemKey, row.value);
    }

    const requiredKeys = getRequiredItemKeys();
    const progress = calculateProgress(teamResponses, requiredKeys);
    const status = toStatus(inspectionRow.status);

    const teamBasics = loadTeamBasics(eventDb);
    const teamInfo = teamBasics.find((t) => t.teamNumber === teamNumber);

    return {
      team: {
        teamNumber,
        teamName: teamInfo?.teamName ?? null,
      },
      inspection: {
        id: String(teamNumber),
        status,
        statusCode: STATUS_CODES[status],
        statusLabel: STATUS_LABELS[status],
        comment: inspectionRow.comment ?? null,
        startedAt: inspectionRow.startedAt
          ? new Date(inspectionRow.startedAt).toISOString()
          : null,
        finalizedAt: inspectionRow.finalizedAt
          ? new Date(inspectionRow.finalizedAt).toISOString()
          : null,
        updatedAt: inspectionRow.updatedAt
          ? new Date(inspectionRow.updatedAt).toISOString()
          : null,
      },
      progress,
      responses,
      checklist: {
        sections: checklistConfig.sections,
        items: checklistConfig.items,
      },
    };
  });
}

export function updateInspectionItems(
  eventCode: string,
  teamNumber: number,
  items: Array<{ key: string; value: string | null }>
): InspectionDetailResult {
  assertEventExists(eventCode);

  withEventDb(eventCode, (eventDb) => {
    ensureInspectionTables(eventDb);

    const now = Date.now();

    eventDb
      .query(
        "INSERT OR IGNORE INTO inspections (team_number, status) VALUES (?, 'NOT_STARTED')"
      )
      .run(teamNumber);

    eventDb.exec("BEGIN TRANSACTION");
    try {
      for (const item of items) {
        eventDb
          .query(
            "INSERT INTO inspection_responses (team_number, item_key, value, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(team_number, item_key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
          )
          .run(teamNumber, item.key, item.value, now);
      }

      const currentRow = eventDb
        .query("SELECT status FROM inspections WHERE team_number = ?")
        .get(teamNumber) as { status: string } | null;

      if (currentRow?.status === "NOT_STARTED") {
        eventDb
          .query(
            "UPDATE inspections SET status = 'IN_PROGRESS', started_at = ?, updated_at = ? WHERE team_number = ?"
          )
          .run(now, now, teamNumber);
      } else {
        eventDb
          .query("UPDATE inspections SET updated_at = ? WHERE team_number = ?")
          .run(now, teamNumber);
      }

      eventDb.exec("COMMIT");
    } catch (error) {
      eventDb.exec("ROLLBACK");
      throw error;
    }
  });

  return getInspectionDetail(eventCode, teamNumber);
}

export function updateInspectionStatus(
  eventCode: string,
  teamNumber: number,
  status: string,
  changedBy: string
): InspectionDetailResult {
  if (!VALID_STATUSES.has(status)) {
    throw new ServiceError(`Invalid inspection status: "${status}".`, 400);
  }

  assertEventExists(eventCode);

  withEventDb(eventCode, (eventDb) => {
    ensureInspectionTables(eventDb);

    const now = Date.now();

    eventDb
      .query(
        "INSERT OR IGNORE INTO inspections (team_number, status) VALUES (?, 'NOT_STARTED')"
      )
      .run(teamNumber);

    const currentRow = eventDb
      .query("SELECT status FROM inspections WHERE team_number = ?")
      .get(teamNumber) as { status: string } | null;
    const oldStatus = currentRow?.status ?? "NOT_STARTED";

    if (status === "PASSED") {
      const responseRows = eventDb
        .query(
          "SELECT item_key AS itemKey, value FROM inspection_responses WHERE team_number = ?"
        )
        .all(teamNumber) as Array<{ itemKey: string; value: string | null }>;

      const teamResponses = new Map<string, string | null>();
      for (const row of responseRows) {
        teamResponses.set(row.itemKey, row.value);
      }

      const requiredKeys = getRequiredItemKeys();
      const progress = calculateProgress(teamResponses, requiredKeys);

      if (progress.missingRequired > 0) {
        throw new ServiceError(
          `Cannot mark as PASSED: ${progress.missingRequired} required items are not completed.`,
          400
        );
      }
    }

    const finalizedAt = status === "PASSED" ? now : null;

    eventDb
      .query(
        "UPDATE inspections SET status = ?, finalized_at = ?, updated_at = ? WHERE team_number = ?"
      )
      .run(status, finalizedAt, now, teamNumber);

    recordHistory(
      eventDb,
      teamNumber,
      "STATUS_CHANGE",
      oldStatus,
      status,
      changedBy,
      false
    );
  });

  return getInspectionDetail(eventCode, teamNumber);
}

export function overrideInspectionStatus(
  eventCode: string,
  teamNumber: number,
  comment: string,
  changedBy: string
): InspectionDetailResult {
  assertEventExists(eventCode);

  withEventDb(eventCode, (eventDb) => {
    ensureInspectionTables(eventDb);

    const now = Date.now();

    eventDb
      .query(
        "INSERT OR IGNORE INTO inspections (team_number, status) VALUES (?, 'NOT_STARTED')"
      )
      .run(teamNumber);

    const currentRow = eventDb
      .query("SELECT status FROM inspections WHERE team_number = ?")
      .get(teamNumber) as { status: string } | null;
    const oldStatus = currentRow?.status ?? "NOT_STARTED";

    eventDb
      .query(
        "UPDATE inspections SET status = 'PASSED', comment = ?, finalized_at = ?, updated_at = ? WHERE team_number = ?"
      )
      .run(comment, now, now, teamNumber);

    recordHistory(
      eventDb,
      teamNumber,
      "LEAD_OVERRIDE",
      oldStatus,
      "PASSED",
      changedBy,
      true
    );
  });

  return getInspectionDetail(eventCode, teamNumber);
}

export function getInspectionHistory(
  eventCode: string,
  teamNumber: number
): InspectionHistoryResult {
  assertEventExists(eventCode);

  return withEventDb(eventCode, (eventDb) => {
    ensureInspectionTables(eventDb);

    const rows = eventDb
      .query(
        "SELECT id, team_number AS teamNumber, action, old_status AS oldStatus, new_status AS newStatus, is_override AS isOverride, changed_by AS changedBy, changed_at AS changedAt FROM inspection_history WHERE team_number = ? ORDER BY changed_at DESC"
      )
      .all(teamNumber) as InspectionHistoryRow[];

    const history: InspectionHistoryEntry[] = rows.map((row) => ({
      id: row.id,
      action: row.action,
      oldStatus: row.oldStatus,
      newStatus: row.newStatus,
      isOverride: row.isOverride === 1,
      changedBy: row.changedBy,
      changedAt: new Date(row.changedAt).toISOString(),
    }));

    return { teamNumber, history };
  });
}

export function saveInspectionComment(
  eventCode: string,
  teamNumber: number,
  comment: string
): void {
  assertEventExists(eventCode);

  withEventDb(eventCode, (eventDb) => {
    ensureInspectionTables(eventDb);

    const now = Date.now();

    eventDb
      .query(
        "INSERT OR IGNORE INTO inspections (team_number, status) VALUES (?, 'NOT_STARTED')"
      )
      .run(teamNumber);

    eventDb
      .query(
        "UPDATE inspections SET comment = ?, updated_at = ? WHERE team_number = ?"
      )
      .run(comment, now, teamNumber);
  });
}

export function getPublicInspectionStatus(eventCode: string) {
  assertEventExists(eventCode);

  return withEventDb(eventCode, (eventDb) => {
    ensureInspectionTables(eventDb);

    const teamBasics = loadTeamBasics(eventDb);
    const inspectionRows = loadInspectionRows(eventDb);

    const inspectionByTeam = new Map<number, InspectionRow>();
    for (const row of inspectionRows) {
      inspectionByTeam.set(row.teamNumber, row);
    }

    const teams = teamBasics.map((team) => {
      const inspection = inspectionByTeam.get(team.teamNumber);
      const status = toStatus(inspection?.status);
      return {
        teamNumber: team.teamNumber,
        teamName: team.teamName,
        status,
        statusCode: STATUS_CODES[status],
        statusLabel: STATUS_LABELS[status],
      };
    });

    const statusCounts: Record<InspectionStatus, number> = {
      NOT_STARTED: 0,
      IN_PROGRESS: 0,
      INCOMPLETE: 0,
      PASSED: 0,
    };
    for (const team of teams) {
      statusCounts[team.status]++;
    }

    return { eventCode, teams, statusCounts };
  });
}
