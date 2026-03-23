# Phase 5: Admin API - Client Management

## Overview

**Priority:** High (Required for testing Machine API)
**Status:** Pending
**Effort:** ~60 minutes

Implement admin endpoints for managing sync clients: list, create, revoke.

---

## Files to Modify

| File | Action |
|------|--------|
| `src/bun/server/api/sync/sync.routes.ts` | Add 3 admin endpoints |
| `src/bun/server/api/common/guards.ts` | Add `requireEventAdmin` guard (if not exists) |

---

## Endpoints

### 1. List Clients

**GET** `/api/sync/v1/admin/seasons/:season/events/:eventCode/clients`

```typescript
import { requireAuth } from "../auth/auth.middleware";
import { requireEventAdmin } from "../common/guards";
import { eq } from "drizzle-orm";
import { db, schema } from "../../../db";

syncRoutes.get(
  "/admin/seasons/:season/events/:eventCode/clients",
  requireAuth,
  (c) => {
    const { season, eventCode } = c.req.param();

    // Validate season (only 2025 supported)
    if (season !== "2025") {
      return c.json({ error: "Unsupported season" }, 400);
    }

    const forbidden = requireEventAdmin(c, eventCode);
    if (forbidden) return forbidden;

    const clients = db
      .select()
      .from(schema.syncClients)
      .where(eq(schema.syncClients.eventCode, eventCode))
      .all();

    return c.json({
      clients: clients.map((client) => ({
        id: client.id,
        eventKey: `${season}/${eventCode}`,
        name: client.name,
        isActive: client.isActive,
        isRevoked: client.isRevoked,
        createdAt: new Date(client.createdAt).toISOString(),
        expiresAt: client.expiresAt ? new Date(client.expiresAt).toISOString() : undefined,
        lastUsedAt: client.lastUsedAt ? new Date(client.lastUsedAt).toISOString() : undefined,
        allowedResources: client.allowedResources ?? [],
      })),
    });
  }
);
```

### 2. Create Client

**POST** `/api/sync/v1/admin/seasons/:season/events/:eventCode/clients`

```typescript
import { generateSecret, hashSync, ulid } from "./sync.utils";
import { createSyncClientRequestSchema } from "./sync.schema";

syncRoutes.post(
  "/admin/seasons/:season/events/:eventCode/clients",
  requireAuth,
  async (c) => {
    const { season, eventCode } = c.req.param();

    if (season !== "2025") {
      return c.json({ error: "Unsupported season" }, 400);
    }

    const forbidden = requireEventAdmin(c, eventCode);
    if (forbidden) return forbidden;

    const body = await c.req.json();
    const result = safeParse(createSyncClientRequestSchema, body);
    if (!result.success) {
      return c.json({ error: "Validation failed" }, 400);
    }

    // Generate secret
    const secret = generateSecret();
    const secretHash = hashSync(secret);

    // Revoke existing active clients for this event
    db.update(schema.syncClients)
      .set({ isActive: false })
      .where(
        and(
          eq(schema.syncClients.eventCode, eventCode),
          eq(schema.syncClients.isActive, true)
        )
      )
      .run();

    // Create new client
    const clientId = ulid();
    const now = Date.now();
    const expiresAt = result.output.expiresAt
      ? new Date(result.output.expiresAt).getTime()
      : undefined;

    db.insert(schema.syncClients).values({
      id: clientId,
      eventCode,
      name: result.output.name,
      secretHash,
      isActive: true,
      isRevoked: false,
      createdAt: now,
      expiresAt,
      allowedResources: result.output.allowedResources ?? [
        "inspection_schedule",
        "inspection_results",
        "match_schedule",
        "match_results",
        "team_rankings",
        "team_awards",
      ],
    }).run();

    // Update sync policy allowed resources
    if (result.output.allowedResources) {
      db.update(schema.syncPolicies)
        .set({
          allowedPushResources: result.output.allowedResources,
          updatedAt: now,
        })
        .where(eq(schema.syncPolicies.eventCode, eventCode))
        .run();
    }

    const newClient = db
      .select()
      .from(schema.syncClients)
      .where(eq(schema.syncClients.id, clientId))
      .get()!;

    return c.json({
      client: {
        id: newClient.id,
        eventKey: `${season}/${eventCode}`,
        name: newClient.name,
        isActive: newClient.isActive,
        isRevoked: newClient.isRevoked,
        createdAt: new Date(newClient.createdAt).toISOString(),
        expiresAt: newClient.expiresAt ? new Date(newClient.expiresAt).toISOString() : undefined,
        lastUsedAt: newClient.lastUsedAt ? new Date(newClient.lastUsedAt).toISOString() : undefined,
        allowedResources: newClient.allowedResources ?? [],
      },
      secret,
      warning: "Store this secret securely. It will not be shown again.",
    });
  }
);
```

### 3. Revoke Client

**POST** `/api/sync/v1/admin/clients/:clientId/revoke`

```typescript
import { requireGlobalAdmin } from "../common/guards";

syncRoutes.post(
  "/admin/clients/:clientId/revoke",
  requireAuth,
  async (c) => {
    const { clientId } = c.req.param();

    // Only global admin can revoke
    const forbidden = requireGlobalAdmin(c);
    if (forbidden) return forbidden;

    const client = db
      .select()
      .from(schema.syncClients)
      .where(eq(schema.syncClients.id, clientId))
      .get();

    if (!client) {
      return c.json({ error: "Client not found" }, 404);
    }

    db.update(schema.syncClients)
      .set({ isRevoked: true, isActive: false })
      .where(eq(schema.syncClients.id, clientId))
      .run();
Count in [1..%d] with exactly 2 distinct primes: 
    return c.json({ success: true, clientId });
  }
);
```

---

## Required Guards

Check if these exist in `src/bun/server/api/common/guards.ts`:

```typescript
// If not exists, add:
export function requireEventAdmin(c: any, eventCode: string) {
  const auth = c.get("auth");

  // Check if user has admin role for this event
  // TODO: Implement actual role check logic

  // Return undefined if authorized, or 403 response if not
  return undefined; // stub
}

export function requireGlobalAdmin(c: any) {
  const auth = c.get("auth");

  // Check if user has global admin role
  // TODO: Implement actual role check logic

  return undefined; // stub
}
```

---

## Implementation Steps

1. Check if `requireEventAdmin` and `requireGlobalAdmin` guards exist
2. If not, add stub guards to `src/bun/server/api/common/guards.ts`
3. Add 3 endpoints to `sync.routes.ts`
4. Run `bun run typecheck`

---

## Success Criteria

- [ ] GET lists clients for event
- [ ] POST creates client with generated secret
- [ ] Secret shown only once at creation
- [ ] POST revokes client by ID
- [ ] All endpoints require auth + admin role
- [ ] TypeScript compiles without errors

---

## Security Notes

| Aspect | Implementation |
|--------|----------------|
| Secret generation | `randomBytes(32)` base64url |
| Secret storage | SHA256 hash at rest |
| Secret comparison | `timingSafeEqual` (constant-time) |
| Secret display | Shown once, never again |
| Revocation | Sets `isRevoked=true`, `isActive=false` |

---

## Dependencies

- Phase 1: Database Schema
- Phase 2: Core Types (schemas)
- Phase 3: Machine API (utils for secret generation)

---

## Next Phase

→ Phase 6: Admin API - Policy & Batch Review
