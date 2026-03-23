# NRC Sync API Implementation Plan

## Overview

This plan details the implementation of the NRC Sync API specification for the Electrobun RMS desktop application. The API enables local event-control apps to sync data (inspection schedules, match results, rankings, awards) with the central RMS system.

**Plan Location:** `plans/260311-sync-api-implementation/`

**Season Focus:** 2025 with definitionVersion 2025.1

**Architecture Pattern:** Single-server in-memory hub (following existing inspection sync pattern in `docs/realtime-sync-architecture.md`)

---

## Phase Summary

| Phase | Subject | Status | Detail File |
|-------|---------|--------|-------------|
| 1 | Database Schema | Complete | [`phase-01-database-schema.md`](./phase-01-database-schema.md) |
| 2 | Core Types & Contracts | Complete | [`phase-02-core-types-contracts.md`](./phase-02-core-types-contracts.md) |
| 3 | Machine API - Bootstrap | Complete | [`phase-03-machine-api-bootstrap.md`](./phase-03-machine-api-bootstrap.md) |
| 4 | Machine API - Push | Complete | [`phase-04-machine-api-push.md`](./phase-04-machine-api-push.md) |
| 5 | Admin API - Client Management | Complete | [`phase-05-admin-client-management.md`](./phase-05-admin-client-management.md) |
| 6 | Admin API - Policy & Batch Review | Complete | [`phase-06-admin-policy-review.md`](./phase-06-admin-policy-review.md) |
| 7 | Integration & Testing | Complete | [`phase-07-integration-testing.md`](./phase-07-integration-testing.md) |

---

## Quick Start

```bash
# Start with Phase 1
# Open phase-01-database-schema.md for detailed implementation steps
```

---

## Critical Files for Implementation

| File Path | Reason |
|-----------|--------|
| `src/bun/db/schema.ts` | Core database schema - add sync tables |
| `src/bun/server/api/index.ts` | API route registration - add sync routes |
| `src/bun/server/api/sync/` | New directory for all sync API modules |
| `src/bun/server/api/sync/sync.routes.ts` | Main sync API routes (machine + admin) |
| `src/bun/server/api/sync/sync.schema.ts` | Valibot schemas for validation |
| `src/bun/server/api/sync/sync.service.ts` | Business logic for sync operations |
| `src/bun/server/api/sync/sync.utils.ts` | Crypto utilities |
| `src/bun/server/api/common/guards.ts` | Add sync-specific guards |

---

## Implementation Order

1. **Phase 1** - Database Schema (foundation)
2. **Phase 2** - Core Types & Contracts (validation schemas)
3. **Phase 3** - Machine API - Bootstrap (read-only, lowest risk)
4. **Phase 4** - Machine API - Push (core functionality)
5. **Phase 5** - Admin API - Client Management (dependency for testing)
6. **Phase 6** - Admin API - Policy & Batch Review (completes workflow)
7. **Phase 7** - Integration & Testing (route wiring, end-to-end tests)

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **In-memory hub** | Follows existing inspection pattern; single-server LAN deployment |
| **SQLite for storage** | Consistent with existing app architecture |
| **Bearer token hashing** | Security best practice; mirrors account_secrets pattern |
| **Composite idempotency key** | `clientId + batchId + payloadHash` prevents replay and accidental duplication |
| **Warnings route to review** | Guardrails without blocking legitimate updates |
| **replace_snapshot vs upsert** | Clear semantics for different resource types |

---

## Security Model

### Machine API Authentication
- Bearer token authentication with SHA256 hashing at rest
- Timing-safe comparison to prevent timing attacks
- Secret shown once at creation, never again

### Admin API Authentication
- Uses existing `requireAuth` middleware + `requireEventAdmin` guards
- Only global admins can revoke clients

---

## Unresolved Questions

1. **Change Application Logic**: How should `applyChangeSets` actually apply data to main tables?
2. **Team Validation**: Where do registered teams come from for validation?
3. **Diff Computation**: Should diffs be computed at push time or review time?
4. **Multi-season Support**: Schema supports it, but logic hardcoded to 2025

---

## Related Documentation

- [`docs/sync-api-spec.md`](../../docs/sync-api-spec.md) - Full API specification
- [`docs/realtime-sync-architecture.md`](../../docs/realtime-sync-architecture.md) - Existing sync patterns
