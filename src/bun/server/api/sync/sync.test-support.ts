import { Database } from "bun:sqlite";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { getDataDir, resetForTest } from "../../../db";

const syncTestRunId = process.env.SYNC_TEST_RUN_ID ?? `${process.pid}`;
process.env.SYNC_TEST_RUN_ID = syncTestRunId;

export const TEST_DATA_DIR = join(
  tmpdir(),
  `electrobun-sync-tests-${syncTestRunId}`
);

mkdirSync(TEST_DATA_DIR, { recursive: true });
process.env.ELECTROBUN_DATA_DIR = TEST_DATA_DIR;

// Reset database connection to pick up new ELECTROBUN_DATA_DIR
resetForTest();

const dbModule = await import("../../../db");
const migrateModule = await import("../../../db/migrate");
const authServiceModule = await import("../auth/auth.service");
const syncEventDbModule = await import("./sync.event-db");
const syncRoutesModule = await import("./sync.routes");
const syncSchemaModule = await import("./sync.schema");
const syncCryptoModule = await import(
  "../../infrastructure/adapters/sync/sync-crypto"
);
const syncUseCasesModule = await import("../../application/use-cases/sync");
const syncRepoModule = await import("../../infrastructure/adapters/sync");
const eventRepoModule = await import("../../infrastructure/adapters/events");
const notificationModule = await import(
  "../../infrastructure/services/sync-notification-publisher"
);

export const { DATA_DIR, db, schema } = dbModule;
export const { resetDatabase } = migrateModule;
export const { issueAccessToken } = authServiceModule;
export const { applySyncChangeSetsToEventDb } = syncEventDbModule;
export const { syncRoutes } = syncRoutesModule;
export const {
  DEFAULT_ALLOWED_PUSH_RESOURCES,
  SYNC_DEFINITION_VERSION,
  SYNC_SCHEMA_VERSION,
} = syncSchemaModule;
export const { hashSyncSecret: hashSync } = syncCryptoModule;

// Test-only use-case wrappers (previously in sync.service.ts)
export const { SyncError } = syncUseCasesModule;

const testSyncRepository = new syncRepoModule.SQLiteSyncRepository(
  notificationModule.publishNotifications
);
const testEventRepository = new eventRepoModule.SQLiteEventRepository();
const testAuthenticateUseCase =
  new syncUseCasesModule.AuthenticateSyncClientUseCase(testSyncRepository);
const testGetBootstrapUseCase = new syncUseCasesModule.GetEventBootstrapUseCase(
  testEventRepository,
  testSyncRepository
);
const testPushBatchUseCase = new syncUseCasesModule.PushSyncBatchUseCase(
  testSyncRepository
);

export const authenticateSyncClient = (bearerToken: string) =>
  testAuthenticateUseCase.execute({ bearerToken });

export const getEventBootstrap = (eventCode: string) =>
  testGetBootstrapUseCase.execute({ eventCode });

export const pushSyncBatch = (
  input: Parameters<
    typeof syncUseCasesModule.PushSyncBatchUseCase.prototype.execute
  >[0]
) => testPushBatchUseCase.execute(input);

interface TestRoleAssignment {
  event: string;
  role: (typeof schema.ROLE_VALUES)[number];
}

export async function resetSyncTestDatabase(): Promise<void> {
  await resetDatabase();

  for (const fileName of readdirSync(TEST_DATA_DIR)) {
    if (fileName.endsWith(".db") && fileName !== "server.db") {
      rmSync(join(TEST_DATA_DIR, fileName), { force: true });
    }
  }
}

export function createSyncTestApp(): Hono {
  const app = new Hono();
  app.route("/", syncRoutes);
  return app;
}

export function createToken(input: {
  roles: TestRoleAssignment[];
  type?: number;
  username?: string;
}): Promise<string> {
  return issueAccessToken({
    username: input.username ?? "admin",
    type: input.type ?? 0,
    roles: input.roles,
  });
}

export function createEventDb(
  eventCode: string,
  teamNumbers: string[] = []
): string {
  const eventDbPath = join(getDataDir(), `${eventCode}.db`);
  rmSync(eventDbPath, { force: true });

  const eventDb = new Database(eventDbPath);
  try {
    if (teamNumbers.length > 0) {
      eventDb.exec(`CREATE TABLE team_metadata (
        team_number INTEGER NOT NULL,
        team_name TEXT,
        organization_school TEXT,
        city TEXT,
        country TEXT
      )`);

      const insertTeam = eventDb.query(
        `INSERT INTO team_metadata (
          team_number,
          team_name,
          organization_school,
          city,
          country
        ) VALUES (?, ?, ?, ?, ?)`
      );

      for (const teamNumber of teamNumbers) {
        insertTeam.run(
          Number(teamNumber),
          `Team ${teamNumber}`,
          `Org ${teamNumber}`,
          "",
          ""
        );
      }
    }
  } finally {
    eventDb.close();
  }

  return eventDbPath;
}

export function openEventDb(eventCode: string): Database {
  return new Database(join(getDataDir(), `${eventCode}.db`));
}

export function insertEvent(eventCode: string): void {
  db.insert(schema.events)
    .values({
      code: eventCode,
      divisions: 1,
      end: Date.parse("2026-03-24T00:00:00.000Z"),
      fields: 1,
      finals: 1,
      name: `Event ${eventCode}`,
      region: "Test Region",
      start: Date.parse("2026-03-23T00:00:00.000Z"),
      status: 1,
      type: 1,
    })
    .run();
}

export function insertSyncPolicy(
  eventCode: string,
  overrides: {
    allowedPushResources?: string[];
    isSyncEnabled?: boolean;
    reviewMode?: "AUTO_ACCEPT" | "MANUAL_REVIEW";
    scheduleOwner?: "LOCAL_APP" | "WEB";
  } = {}
): void {
  db.insert(schema.syncPolicies)
    .values({
      allowedPushResources: overrides.allowedPushResources ?? [
        ...DEFAULT_ALLOWED_PUSH_RESOURCES,
      ],
      eventCode,
      isSyncEnabled: overrides.isSyncEnabled ?? true,
      reviewMode: overrides.reviewMode ?? "AUTO_ACCEPT",
      scheduleOwner: overrides.scheduleOwner ?? "WEB",
      updatedAt: Date.now(),
      updatedBy: "sync-tests",
    })
    .run();
}

export function insertSyncClient(
  eventCode: string,
  overrides: {
    allowedResources?: string[];
    expiresAt?: number;
    id?: string;
    isActive?: boolean;
    isRevoked?: boolean;
    secret?: string;
  } = {}
): string {
  const secret = overrides.secret ?? "sync-secret";

  db.insert(schema.syncClients)
    .values({
      allowedResources: overrides.allowedResources ?? ["inspection_results"],
      createdAt: Date.now(),
      eventCode,
      expiresAt: overrides.expiresAt,
      id: overrides.id ?? "client-1",
      isActive: overrides.isActive ?? true,
      isRevoked: overrides.isRevoked ?? false,
      name: "Sync Test Client",
      secretHash: hashSync(secret),
    })
    .run();

  return secret;
}

export function insertSyncOutboundLink(
  eventCode: string,
  overrides: {
    allowedPullResources?: string[];
    allowedPushResources?: string[];
    baseUrl?: string;
    bearerSecret?: string;
    definitionVersion?: string;
    remoteEventKey?: string;
    reviewMode?: "AUTO_ACCEPT" | "MANUAL_REVIEW";
    scheduleOwner?: "LOCAL_APP" | "WEB";
  } = {}
): void {
  db.insert(schema.syncOutboundLinks)
    .values({
      eventCode,
      baseUrl: overrides.baseUrl ?? "http://localhost:3001",
      bearerSecret: overrides.bearerSecret ?? "outbound-secret",
      remoteEventKey: overrides.remoteEventKey ?? `2025/${eventCode}`,
      definitionVersion: overrides.definitionVersion ?? SYNC_DEFINITION_VERSION,
      allowedPushResources: overrides.allowedPushResources ?? [
        ...DEFAULT_ALLOWED_PUSH_RESOURCES,
      ],
      allowedPullResources: overrides.allowedPullResources ?? [
        "season_definition",
        "event_manifest",
        "approved_registrations",
        "team_operational_profiles",
        "sync_policy",
      ],
      reviewMode: overrides.reviewMode ?? "AUTO_ACCEPT",
      scheduleOwner: overrides.scheduleOwner ?? "WEB",
      bootstrappedAt: Date.now(),
      updatedAt: Date.now(),
    })
    .run();
}

export function createInspectionResultPayload(
  overrides: {
    batchId?: string;
    comment?: string;
    recordedAt?: string;
    stage?: string;
    status?: string;
    teamNumber?: string;
  } = {}
) {
  const record = {
    recordedAt: overrides.recordedAt ?? "2026-03-23T10:00:00.000Z",
    stage: overrides.stage ?? "GENERAL",
    status: overrides.status ?? "PASSED",
    teamNumber: overrides.teamNumber ?? "123",
  };

  return {
    batchId: overrides.batchId ?? crypto.randomUUID(),
    definitionVersion: SYNC_DEFINITION_VERSION,
    producedAt: "2026-03-23T10:00:00.000Z",
    resources: [
      {
        mode: "upsert" as const,
        records: [
          overrides.comment
            ? { ...record, comment: overrides.comment }
            : record,
        ],
        resourceType: "inspection_results" as const,
      },
    ],
    schemaVersion: SYNC_SCHEMA_VERSION,
  };
}

export async function waitFor(
  predicate: () => boolean,
  description: string
): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) {
      return;
    }

    await Bun.sleep(10);
  }

  throw new Error(`Timed out waiting for ${description}.`);
}
