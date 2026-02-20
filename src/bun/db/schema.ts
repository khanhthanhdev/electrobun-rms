import { sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
} from "drizzle-orm/sqlite-core";

export const ROLE_VALUES = [
	"ADMIN",
	"TSO",
	"HEAD_REFEREE",
	"REFEREE",
	"INSPECTOR",
	"LEAD_INSPECTOR",
	"JUDGE",
] as const;

export type RoleValue = (typeof ROLE_VALUES)[number];

export const events = sqliteTable("events", {
	code: text("code").primaryKey(),
	name: text("name").notNull(),
	type: integer("type").notNull(),
	status: integer("status").notNull(),
	finals: integer("finals").notNull(),
	divisions: integer("divisions").notNull(),
	start: integer("start").notNull(),
	end: integer("end").notNull(),
	region: text("region").notNull(),
});

export const users = sqliteTable("users", {
	username: text("username").primaryKey(),
	hashedPassword: text("hashed_password").notNull(),
	salt: text("salt"),
	type: integer("type").notNull().default(0),
	realName: text("real_name"),
	used: integer("used", { mode: "boolean" }).notNull().default(true),
	generic: integer("generic", { mode: "boolean" }).notNull().default(false),
});

export const roles = sqliteTable(
	"roles",
	{
		username: text("username").notNull(),
		role: text("role").notNull(),
		event: text("event").notNull().default("*"),
	},
	(table) => [
		primaryKey({
			columns: [table.username, table.role, table.event],
		}),
		foreignKey({
			columns: [table.username],
			foreignColumns: [users.username],
			name: "roles_user_fk",
		}).onDelete("cascade"),
		index("idx_roles_username").on(table.username),
		index("idx_roles_event").on(table.event),
		check(
			"roles_role_check",
			sql`${table.role} IN ('ADMIN', 'TSO', 'HEAD_REFEREE', 'REFEREE', 'INSPECTOR', 'LEAD_INSPECTOR', 'JUDGE')`,
		),
	],
);

export const config = sqliteTable("config", {
	key: text("key").primaryKey(),
	value: text("value").notNull(),
});

export const eventLog = sqliteTable(
	"event_log",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		timestamp: integer("timestamp").notNull(),
		type: text("type").notNull(),
		event: text("event"),
		info: text("info").notNull(),
		extra: text("extra").notNull(),
	},
	(table) => [
		index("idx_event_log_timestamp").on(table.timestamp),
		index("idx_event_log_event").on(table.event),
	],
);

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;

export type Config = typeof config.$inferSelect;
export type NewConfig = typeof config.$inferInsert;

export type EventLog = typeof eventLog.$inferSelect;
export type NewEventLog = typeof eventLog.$inferInsert;
