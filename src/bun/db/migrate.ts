import { db, schema } from "./index";
import { sql } from "drizzle-orm";

export function runMigrations() {
  db.run(sql`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  console.log("Database migrations completed.");
}
