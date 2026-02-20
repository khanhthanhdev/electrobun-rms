import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { and, eq } from "drizzle-orm";
import { db, schema, sqlite } from "./index";

const JWT_SECRET_KEY = "jwt_secret";
const DEFAULT_ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_PASSWORD = "admin1234";

let initialized = false;

function resolveSchemaPath(): string {
	const candidates = [
		resolve(import.meta.dir, "../docs/schema/server.sql"),
		resolve(process.cwd(), "docs", "schema", "server.sql"),
		resolve(import.meta.dir, "../../../docs/schema/server.sql"),
		resolve(import.meta.dir, "../../docs/schema/server.sql"),
	];

	for (const filePath of candidates) {
		if (existsSync(filePath)) {
			return filePath;
		}
	}

	throw new Error(
		`Unable to locate schema SQL file. Tried: ${candidates.join(", ")}`,
	);
}

function loadSchemaSql(): string {
	const schemaPath = resolveSchemaPath();
	return readFileSync(schemaPath, "utf8");
}

function generateSecret(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return Buffer.from(bytes).toString("base64url");
}

async function ensureJwtSecret(): Promise<void> {
	const [existing] = await db
		.select({ value: schema.config.value })
		.from(schema.config)
		.where(eq(schema.config.key, JWT_SECRET_KEY))
		.limit(1)
		.all();

	if (existing) {
		return;
	}

	await db.insert(schema.config).values({
		key: JWT_SECRET_KEY,
		value: generateSecret(),
	});
}

async function ensureDefaultAdmin(): Promise<void> {
	const [existingUser] = await db
		.select({ username: schema.users.username })
		.from(schema.users)
		.where(eq(schema.users.username, DEFAULT_ADMIN_USERNAME))
		.limit(1)
		.all();

	if (!existingUser) {
		const hashedPassword = await Bun.password.hash(DEFAULT_ADMIN_PASSWORD, {
			algorithm: "bcrypt",
			cost: 10,
		});

		await db.insert(schema.users).values({
			username: DEFAULT_ADMIN_USERNAME,
			hashedPassword,
			type: 0,
			used: true,
			generic: false,
		});
	}

	const [existingRole] = await db
		.select({ username: schema.roles.username })
		.from(schema.roles)
		.where(
			and(
				eq(schema.roles.username, DEFAULT_ADMIN_USERNAME),
				eq(schema.roles.role, "ADMIN"),
				eq(schema.roles.event, "*"),
			),
		)
		.limit(1)
		.all();

	if (!existingRole) {
		await db.insert(schema.roles).values({
			username: DEFAULT_ADMIN_USERNAME,
			role: "ADMIN",
			event: "*",
		});
	}
}

async function writeBootLog(): Promise<void> {
	await db.insert(schema.eventLog).values({
		timestamp: Date.now(),
		type: "BOOT",
		event: null,
		info: "SERVER_INIT",
		extra: "[]",
	});
}

async function seedDefaults(): Promise<void> {
	await ensureJwtSecret();
	await ensureDefaultAdmin();
	await writeBootLog();
}

export async function initializeDatabase(): Promise<void> {
	if (initialized) {
		return;
	}

	sqlite.exec(loadSchemaSql());
	await seedDefaults();
	initialized = true;
	console.log("Database initialized.");
}

export async function resetDatabase(): Promise<void> {
	const tableRows = sqlite
		.query(
			"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
		)
		.all() as Array<{ name: string }>;

	sqlite.exec("PRAGMA foreign_keys = OFF;");
	for (const { name } of tableRows) {
		const escaped = name.split('"').join('""');
		sqlite.exec(`DROP TABLE IF EXISTS \"${escaped}\";`);
	}
	sqlite.exec("PRAGMA foreign_keys = ON;");

	initialized = false;
	await initializeDatabase();
	console.log("Database reset completed.");
}
