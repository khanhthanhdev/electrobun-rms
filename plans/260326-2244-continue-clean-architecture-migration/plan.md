# Continue Clean Architecture Migration

**Status:** In Progress
**Created:** 2026-03-26
**Priority:** High

## Migration Dashboard

| Phase | Domain | Status | Effort |
|-------|--------|--------|--------|
| 1 | Rankings | Complete | 1-2 hours |
| 2 | Auth | Complete (simplified) | 30 min |
| 3 | Print Lists | Pending | 1-2 hours |
| 4 | Cleanup | Blocked | 30 min |

## Architecture Pattern (Established)

```
api/           → Hono routes + thin controllers + SSE handlers
application/   → Use-cases, interfaces, DTOs, ApplicationError
domain/        → Entities, VOs, season-rules (business logic)
infrastructure/ → SQLite repositories implementing interfaces
```

**Reference Implementations:**
- Scoring: `src/bun/server/api/scoring/scoring.routes.ts` (25 tests passing)
- Inspection: `src/bun/server/api/inspection/inspection.routes.ts`
- Rankings: `src/bun/server/api/ranking/ranking.routes.ts` (Phase 1)

**Exception - Auth (kept simple):**
- Auth stays as service module in `api/auth/auth.service.ts`
- Direct DB access acceptable for cross-cutting auth concern
- No use-case/repository abstraction needed (YAGNI)

## Phase Dependencies

```
Phase 1 (Rankings) → Independent
Phase 2 (Auth)     → Independent, cross-cutting concern
Phase 3 (Print)    → Independent
Phase 4 (Cleanup)  → Blocked by Phases 1-3
```

## Key Files

| Purpose | Path |
|---------|------|
| Plan Overview | `plans/260326-2244-continue-clean-architecture-migration/plan.md` |
| Phase 1 | `phase-01-migrate-rankings-domain.md` |
| Phase 2 | `phase-02-migrate-auth-domain.md` |
| Phase 3 | `phase-03-migrate-print-lists-domain.md` |
| Phase 4 | `phase-04-cleanup-legacy-services.md` |

## Related Reports

- Code Review: `plans/reports/code-review-260326-0856-clean-architecture-migration.md`
- Migration Drift: `plans/reports/migration-status-drift-260326-2213.md`
