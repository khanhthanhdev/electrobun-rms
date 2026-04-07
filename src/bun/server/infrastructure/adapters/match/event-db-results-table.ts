import type { Database } from "bun:sqlite";

export type EventDbResultsTableName =
  | "elims_results"
  | "practice_results"
  | "quals_results";

const VALID_RESULTS_TABLES: ReadonlySet<string> = new Set<EventDbResultsTableName>([
  "elims_results",
  "practice_results",
  "quals_results",
]);

export const ensureResultsTable = (
  eventDb: Database,
  tableName: EventDbResultsTableName
): void => {
  if (!VALID_RESULTS_TABLES.has(tableName)) {
    throw new Error(`Invalid results table name: ${tableName}`);
  }
  eventDb.exec(`CREATE TABLE IF NOT EXISTS ${tableName} (
    match INTEGER NOT NULL,
    red_score INTEGER NOT NULL,
    blue_score INTEGER NOT NULL,
    red_penalty_committed INTEGER NOT NULL,
    blue_penalty_committed INTEGER NOT NULL
  )`);
};
