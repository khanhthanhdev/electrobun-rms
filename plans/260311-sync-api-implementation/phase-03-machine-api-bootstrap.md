# Phase 3: Machine API - Bootstrap Endpoint

## Overview

**Priority:** High (First functional endpoint)
**Status:** Pending
**Effort:** ~45 minutes

Implement `GET /api/sync/v1/machine/bootstrap` for sync clients to fetch initial event data.

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/bun/server/api/sync/sync.utils.ts` | Create - crypto utilities |
| `src/bun/server/api/sync/sync.service.ts` | Create - business logic |
| `src/bun/server/api/sync/sync.routes.ts` | Create - route handlers |

---

## Utilities (sync.utils.ts)

```typescript
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

const SECRET_LENGTH = 32;

export function generateSecret(): string {
  return randomBytes(SECRET_LENGTH).toString("base64url");
}

export function hashSync(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function compareSync(secret: string, hash: string): boolean {
  const secretHash = hashSync(secret);
  try {
    return timingSafeEqual(Buffer.from(hash), Buffer.from(secretHash));
  } catch {
    return false;
  }
}

export function ulid(): string {
  return crypto.randomUUID();
}
```

---

## Service Layer (sync.service.ts)

### Client Authentication

```typescript
import { eq } from "drizzle-orm";
import { db, schema } from "../../../db";
import { compareSync } from "./sync.utils";

interface SyncClientAuth {
  clientId: string;
  eventCode: string;
  allowedResources: string[];
}

export function authenticateSyncClient(bearerToken: string): SyncClientAuth {
  const clients = db.select().from(schema.syncClients).all();

  const validClient = clients.find((client) => {
    if (!client.isActive || client.isRevoked) return false;
    if (client.expiresAt && Date.now() > client.expiresAt) return false;
    return compareSync(bearerToken, client.secretHash);
  });

  if (!validClient) {
    throw new Error("Invalid sync client credentials");
  }

  return {
    clientId: validClient.id,
    eventCode: validClient.eventCode,
    allowedResources: validClient.allowedResources ?? [],
  };
}
```

### Bootstrap Data Fetcher

```typescript
export function getEventBootstrap(eventCode: string) {
  const event = db
    .select()
    .from(schema.events)
    .where(eq(schema.events.code, eventCode))
    .get();

  if (!event) {
    throw new Error("Event not found");
  }

  const policy = db
    .select()
    .from(schema.syncPolicies)
    .where(eq(schema.syncPolicies.eventCode, eventCode))
    .get();

  // TODO: Query actual registrations and team profiles
  const registrations = [];
  const profiles = [];

  return {
    schemaVersion: "2026-03-08",
    generatedAt: new Date().toISOString(),
    resources: {
      seasonDefinition: {
        schemaVersion: "2026-03-08",
        season: "2025",
        definitionVersion: "2025.1",
        gameCode: "nrc-2025",
        gameName: "NRC 2025",
        matchResultDetailsVersion: "2025.1",
        rankingDetailsVersion: "2025.1",
        publicViews: {},
        diffLabels: {},
        generatedAt: new Date().toISOString(),
      },
      eventManifest: {
        season: "2025",
        eventCode: event.code,
        eventKey: `2025/${event.code}`,
        canonicalPath: `/2025/${event.code}`,
        name: event.name,
        venue: undefined,
        timezone: "Asia/Ho_Chi_Minh",
        startsAt: new Date(event.start).toISOString(),
        endsAt: new Date(event.end).toISOString(),
        definitionVersion: "2025.1",
        scheduleOwner: policy?.scheduleOwner ?? "WEB",
        syncReviewMode: policy?.reviewMode ?? "AUTO_ACCEPT",
        isSyncEnabled: policy?.isSyncEnabled ?? false,
      },
      approvedRegistrations: registrations,
      teamOperationalProfiles: profiles,
      syncPolicy: {
        eventKey: `2025/${event.code}`,
        reviewMode: policy?.reviewMode ?? "AUTO_ACCEPT",
        scheduleOwner: policy?.scheduleOwner ?? "WEB",
        allowedPushResources: policy?.allowedPushResources ?? [],
        allowedPullResources: [
          "season_definition",
          "event_manifest",
          "approved_registrations",
          "team_operational_profiles",
          "sync_policy",
        ],
        updatedAt: new Date(policy?.updatedAt ?? Date.now()).toISOString(),
      },
    },
  };
}
```

---

## Route Handler (sync.routes.ts)

```typescript
import { Hono } from "hono";
import { safeParse } from "valibot";
import type { AppEnv } from "../common/app-env";
import { authenticateSyncClient, getEventBootstrap } from "./sync.service";
import { eventBootstrapResponseSchema } from "./sync.schema";

export const syncRoutes = new Hono<AppEnv>();

// Machine Bootstrap Endpoint
syncRoutes.get("/machine/bootstrap", async (c) => {
  const authorization = c.req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return c.json({ error: "UNAUTHORIZED", message: "Bearer token required" }, 401);
  }

  const token = authorization.replace(/^Bearer\s+/i, "");

  try {
    const auth = authenticateSyncClient(token);

    // Update last used timestamp
    // db.update(schema.syncClients).set({ lastUsedAt: Date.now() })...

    const bootstrap = getEventBootstrap(auth.eventCode);

    // Validate response schema (dev safety)
    const result = safeParse(eventBootstrapResponseSchema, bootstrap);
    if (!result.success) {
      c.get("app").logger.error("Bootstrap schema validation failed", result.issues);
    }

    return c.json(bootstrap);
  } catch (error) {
    if (error instanceof Error) {
      const status = error.message === "Invalid sync client credentials" ? 401
        : error.message === "Event not found" ? 404 : 500;
      return c.json({ error: error.message }, status);
    }
    throw error;
  }
});
```

---

## Implementation Steps

1. Create `sync.utils.ts` with crypto utilities
2. Create `sync.service.ts` with auth + bootstrap functions
3. Create `sync.routes.ts` with bootstrap endpoint
4. Run `bun run typecheck` to verify

---

## Success Criteria

- [ ] `GET /api/sync/v1/machine/bootstrap` endpoint works
- [ ] Returns 401 without valid bearer token
- [ ] Returns bootstrap data with valid token
- [ ] TypeScript compiles without errors

---

## Testing

```bash
# Test without auth (should fail)
curl http://localhost:3000/api/sync/v1/machine/bootstrap

# Test with valid token (after creating client via Admin API)
curl -H "Authorization: Bearer <secret>" \
  http://localhost:3000/api/sync/v1/machine/bootstrap
```

---

## Dependencies

- Phase 1: Database Schema (tables must exist)
- Phase 2: Core Types (schemas for validation)

---

## Next Phase

→ Phase 4: Machine API - Push Endpoint
