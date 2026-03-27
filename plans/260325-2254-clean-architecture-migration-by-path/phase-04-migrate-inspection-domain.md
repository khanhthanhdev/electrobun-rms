# Phase 04: Migrate Inspection Domain

**Parent Plan:** `./plan.md`
**Priority:** 4
**Status:** Completed
**Effort:** 3-5 hours

## Context Links

- Parent path plan: [plan.md](./plan.md)
- Current inspection routes: `src/bun/server/api/inspection/inspection.routes.ts`
- Current inspection service: `src/bun/server/api/inspection/inspection.service.ts`
- Current inspection sync: `src/bun/server/api/inspection/inspection-sync.ts`

## Overview

Move Inspection table bootstrap, persistence, and workflow orchestration behind `InspectionRepository` and application use-cases while preserving all inspection routes and sync events.

## Key Insights

- Inspection lives entirely under `api/inspection` today, but the service file already behaves like a mixed service and repository.
- The current implementation creates tables, checks event existence, reads and writes inspection state, and shapes public projections in one place.
- Inspection sync publishing is business-critical and must remain route-driven after successful writes.

## Requirements

- Functional:
  - Preserve checklist, team list, detail, item update, status update, comment, history, override, and public-status endpoints.
  - Preserve `ITEMS_UPDATED`, `STATUS_UPDATED`, `COMMENT_UPDATED`, and `OVERRIDE_APPLIED`.
  - Preserve inspector and lead-inspector guard behavior.
- Non-functional:
  - Event table bootstrap moves out of route code.
  - Public projection logic is still available without leaking persistence details.

## Architecture

- `api/inspection/*.routes.ts` keeps route parsing, auth, and sync publishing.
- `application/use-cases/inspection/*` owns checklist, detail, update, override, history, and public projection workflows.
- `application/interfaces/inspection-repository.ts` owns event existence, table bootstrap, and inspection persistence contracts.
- `infrastructure/adapters/inspection/sqlite-inspection-repository.ts` owns event DB access.

## Related Code Files

- Modify:
  - `src/bun/server/api/inspection/inspection.routes.ts`
  - `src/bun/server/api/inspection/inspection-sync.ts`
  - `src/bun/server/application/use-cases/inspection/index.ts`
- Create:
  - `src/bun/server/application/dtos/inspection/index.ts`
  - `src/bun/server/application/interfaces/inspection-repository.ts`
  - `src/bun/server/application/use-cases/inspection/get-checklist.ts`
  - `src/bun/server/application/use-cases/inspection/get-team-list.ts`
  - `src/bun/server/application/use-cases/inspection/get-team-detail.ts`
  - `src/bun/server/application/use-cases/inspection/update-inspection-item.ts`
  - `src/bun/server/application/use-cases/inspection/update-inspection-status.ts`
  - `src/bun/server/application/use-cases/inspection/apply-override.ts`
  - `src/bun/server/application/use-cases/inspection/save-comment.ts`
  - `src/bun/server/application/use-cases/inspection/get-inspection-history.ts`
  - `src/bun/server/application/use-cases/inspection/get-public-status.ts`
  - `src/bun/server/infrastructure/adapters/inspection/sqlite-inspection-repository.ts`
- Delete:
  - `src/bun/server/api/inspection/inspection.service.ts`

## Implementation Steps

1. Add route and SSE parity tests for the inspection workflow.
2. Extract inspection DTOs for checklist, detail, item updates, status changes, comments, overrides, and history.
3. Define `InspectionRepository` with event bootstrap and persistence operations.
4. Implement explicit use-cases for each route behavior.
5. Move event DB table creation and persistence into the SQLite adapter.
6. Rewire inspection routes to use the new application layer and keep sync publishing unchanged.
7. Delete the legacy inspection service after verification.

## Todo List

- [x] Inspection DTOs cover all current route behaviors.
- [x] Repository owns event existence checks and table bootstrap.
- [x] All inspection sync events still publish after successful writes.
- [x] Legacy inspection service is removed.

## Success Criteria

- Inspection routes and auth behavior remain unchanged.
- Inspection sync payload timing remains unchanged.
- Public inspection status still projects the same data.

## Risk Assessment

- Risk is medium because the current service mixes multiple responsibilities that can hide edge-case behavior.
- Sync regressions are possible if publish timing shifts.

## Security Considerations

- Preserve current role-based guards for inspector and lead-inspector actions.
- Keep public-status read behavior scoped exactly as it works today.

## Next Steps

- Teams is next and should be a smaller migration if Inspection establishes the pattern for event DB-backed repositories.
