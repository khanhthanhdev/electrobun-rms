# Phase 09: Migrate Sync Domain

**Parent Plan:** `./plan.md`
**Priority:** 9
**Status:** Completed
**Effort:** 5-8 hours

## Context Links

- Parent path plan: [plan.md](./plan.md)
- Current sync routes and services: `src/bun/server/api/sync/*`
- Existing regression tests: `src/bun/server/api/sync/sync.service.test.ts`, `src/bun/server/api/sync/sync.event-db.test.ts`

## Overview

Migrate Sync last, after the upstream Scoring, Ranking, Schedule, Inspection, Teams, Events, and Users boundaries are stable. Split machine auth/bootstrap, machine push/review, and admin management concerns into distinct use-cases and adapters.

## Key Insights

- Sync is the highest-coupling path because it touches event DB projectors, machine auth, bootstrap, and admin workflows.
- Existing Sync tests are already valuable regression coverage and should become the non-negotiable baseline.
- Trying to migrate Sync before upstream repositories stabilize will cause churn across several other paths.

## Requirements

- Functional:
  - Preserve all machine and admin sync route contracts.
  - Preserve bootstrap payloads, batch push flows, review flows, and policy/client management behavior.
  - Preserve current sync schema contracts and projectors.
- Non-functional:
  - Split Sync responsibilities into bounded use-cases.
  - Keep event DB projector logic in infrastructure adapters.
  - Reuse stable repositories from earlier migrated paths instead of duplicating logic.

## Architecture

- `api/sync/*.routes.ts` keeps machine/admin transport, auth, and validation.
- `application/use-cases/sync/*` owns machine auth, bootstrap orchestration, push/review, and admin management workflows.
- `application/interfaces/*` adds Sync-specific repositories only where existing repositories are insufficient.
- `infrastructure/adapters/sync/*` owns event DB projectors and persistence-heavy sync helpers.
- `infrastructure/services/*` owns bootstrap-specific infrastructure helpers.

## Related Code Files

- Modify:
  - `src/bun/server/api/sync/sync.routes.ts`
  - `src/bun/server/api/sync/sync.service.ts`
  - `src/bun/server/api/sync/sync-bootstrap.service.ts`
  - `src/bun/server/api/sync/sync.event-db.ts`
  - `src/bun/server/api/sync/sync-event-db-*.ts`
- Create:
  - `src/bun/server/application/dtos/sync/index.ts`
  - `src/bun/server/application/use-cases/sync/index.ts`
  - `src/bun/server/application/use-cases/sync/authenticate-sync-client.ts`
  - `src/bun/server/application/use-cases/sync/get-event-bootstrap.ts`
  - `src/bun/server/application/use-cases/sync/push-sync-batch.ts`
  - `src/bun/server/application/use-cases/sync/apply-sync-batch-review.ts`
  - `src/bun/server/application/use-cases/sync/list-sync-clients.ts`
  - `src/bun/server/application/use-cases/sync/create-sync-client.ts`
  - `src/bun/server/application/use-cases/sync/revoke-sync-client.ts`
  - `src/bun/server/application/use-cases/sync/update-sync-policy.ts`
  - `src/bun/server/application/use-cases/sync/bootstrap-event-from-remote.ts`
  - `src/bun/server/infrastructure/adapters/sync/*`
- Delete:
  - `src/bun/server/api/sync/sync.service.ts`
  - Legacy Sync helpers that become adapters or infrastructure services

## Implementation Steps

1. Freeze current Sync behavior with route and integration tests; treat existing test files as the baseline suite.
2. Split Sync DTOs by machine bootstrap, batch push/review, and admin management concerns.
3. Define only the additional repository contracts Sync truly needs.
4. Move projector-heavy event DB code into `infrastructure/adapters/sync`.
5. Implement Sync use-cases around stable upstream repository boundaries.
6. Rewire routes gradually, keeping schema contracts identical.
7. Delete the legacy sync service only after the full regression suite passes.

## Todo List

- [ ] Upstream paths 1-7 are stable before Sync starts.
- [ ] Existing Sync tests remain green throughout.
- [ ] Projector code is moved into infrastructure adapters.
- [ ] Machine and admin flows are separated in application use-cases.
- [ ] Legacy Sync service code is removed only at the end.

## Success Criteria

- Sync contracts remain unchanged for machine and admin clients.
- Sync stops owning cross-domain business logic directly.
- Existing regression tests remain green or are strengthened, never weakened.

## Risk Assessment

- This is the highest-risk phase because Sync spans many domains and transports.
- Schema drift is a major risk because remote clients depend on stable payloads.

## Security Considerations

- Preserve machine authentication behavior exactly.
- Preserve admin authorization and client-secret handling.
- Avoid logging or exposing secrets while moving code across layers.

## Next Steps

- Auth remains separate even after Sync unless a larger framework or auth migration is approved later.
