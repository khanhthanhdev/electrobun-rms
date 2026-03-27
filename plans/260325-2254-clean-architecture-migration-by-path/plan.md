# Clean Architecture Migration Plan by Path

**Parent Plan:** `../260325-2234-clean-architecture-folder-structure/plan.md`
**Created:** 2026-03-25
**Status:** Complete
**Effort:** 16-24 hours total
**Strategy:** Path-by-path migration with zero HTTP or SSE contract changes

## Summary

Migrate one path at a time in this order: **Scoring → Ranking → Schedule → Inspection → Teams → Events → Users → Display → Sync**. Keep Auth out of scope except for import fixes required by the Users migration.

## Phase Index

| Path | Status | Detailed Plan |
|------|--------|---------------|
| 1. Scoring | Completed | [phase-01-migrate-scoring-domain.md](./phase-01-migrate-scoring-domain.md) |
| 2. Ranking | Completed | [phase-02-migrate-ranking-domain.md](./phase-02-migrate-ranking-domain.md) |
| 3. Schedule | Completed | [phase-03-migrate-schedule-domain.md](./phase-03-migrate-schedule-domain.md) |
| 4. Inspection | Completed | [phase-04-migrate-inspection-domain.md](./phase-04-migrate-inspection-domain.md) |
| 5. Teams | Completed | [phase-05-migrate-teams-domain.md](./phase-05-migrate-teams-domain.md) |
| 6. Events | Completed | [phase-06-migrate-events-domain.md](./phase-06-migrate-events-domain.md) |
| 7. Users | Completed | [phase-07-migrate-users-domain.md](./phase-07-migrate-users-domain.md) |
| 8. Display | Completed | [phase-08-align-display-boundary.md](./phase-08-align-display-boundary.md) |
| 9. Sync | Completed | [phase-09-migrate-sync-domain.md](./phase-09-migrate-sync-domain.md) |
| 10. Auth | Out of Scope | [phase-10-preserve-auth-boundary.md](./phase-10-preserve-auth-boundary.md) |

## Global Rules

- Keep every HTTP route, request schema, response shape, auth guard, SSE event name, and stream URL unchanged.
- Keep repository interfaces flat under `application/interfaces/{domain}-repository.ts`.
- Routes own auth, input parsing, and SSE publishing. Use-cases own orchestration. Adapters own DB and filesystem access.
- Replace cross-domain reuse of `ServiceError` with shared `application/common/application-error.ts` as migrated paths are cut over.
- Delete a legacy service only after route parity tests, repository tests, and TypeScript checks are green for that path.

## Key Dependencies

- Path 1 is the reference migration and establishes the shared error pattern.
- Path 2 depends on stable Scoring results and existing `domain/season-rules/ranking`.
- Path 6 depends on Paths 2 and 5 for ranking and team-related behavior to stay isolated.
- Path 7 keeps Auth separate and only removes the Users dependency on `auth.service.ts`.
- Path 8 stays in `api/` unless new persistence or business rules appear.
- Path 9 was blocked by upstream paths 1-7 but has since been completed alongside them.

## Global Validation

- Route parity tests lock status codes, response bodies, guards, and SSE behavior before each cutover.
- Repository integration tests prove read/write parity against real SQLite and event DB layouts.
- Use-case tests cover pure business rules, error paths, and season-rules integration.
- TypeScript must compile without introducing new migration-related errors.

## Done Condition

- Every in-scope path has a completed phase file, green verification, and legacy source removal recorded in its phase checklist.
