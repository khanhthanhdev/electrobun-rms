# Phase 05: Migrate Teams Domain

**Parent Plan:** `./plan.md`
**Priority:** 5
**Status:** Completed
**Effort:** 2-3 hours

## Context Links

- Parent path plan: [plan.md](./plan.md)
- Current teams routes: `src/bun/server/api/teams/teams.routes.ts`
- Current teams wrapper: `src/bun/server/api/teams/teams.service.ts`
- Current teams service: `src/bun/server/services/event-teams-service.ts`

## Overview

Move event team CRUD into the Teams application path, keep search and route contracts unchanged, and expose a non-route seed capability for later Event and Sync use.

## Key Insights

- Teams is smaller than Scoring, Schedule, and Inspection, so it should validate the migration pattern on a lower-risk path.
- `seedEventTeams` exists today even though it is not a direct route concern; that capability should stay available for event bootstrap and Sync later.
- Teams should become a clean dependency for Events rather than staying coupled through legacy services.

## Requirements

- Functional:
  - Preserve list, search, create, update, and delete route behavior.
  - Preserve current team search semantics.
  - Preserve internal team seeding capability for non-route callers.
- Non-functional:
  - Remove the thin API service wrapper.
  - Keep event-specific team persistence behind a repository contract.

## Architecture

- `api/teams/*.routes.ts` keeps route parsing and guards.
- `application/use-cases/teams/*` owns list and CRUD orchestration.
- `application/interfaces/team-repository.ts` owns event team persistence.
- `infrastructure/adapters/teams/sqlite-team-repository.ts` owns SQLite access.

## Related Code Files

- Modify:
  - `src/bun/server/api/teams/teams.routes.ts`
  - `src/bun/server/application/use-cases/index.ts`
- Create:
  - `src/bun/server/application/dtos/teams/index.ts`
  - `src/bun/server/application/interfaces/team-repository.ts`
  - `src/bun/server/application/use-cases/teams/index.ts`
  - `src/bun/server/application/use-cases/teams/list-teams.ts`
  - `src/bun/server/application/use-cases/teams/create-team.ts`
  - `src/bun/server/application/use-cases/teams/update-team.ts`
  - `src/bun/server/application/use-cases/teams/delete-team.ts`
  - `src/bun/server/infrastructure/adapters/teams/sqlite-team-repository.ts`
- Delete:
  - `src/bun/server/api/teams/teams.service.ts`
  - `src/bun/server/services/event-teams-service.ts`

## Implementation Steps

1. Add parity tests for team list, search, create, update, and delete routes.
2. Extract team DTOs and route-facing projections into `application/dtos/teams`.
3. Define `TeamRepository` with CRUD plus `seedTeams`.
4. Implement Teams use-cases and SQLite adapter.
5. Rewire routes directly to use-cases and remove the wrapper.
6. Delete legacy team services after verification.

## Todo List

- [ ] Teams DTOs are application-owned.
- [ ] Search semantics remain unchanged.
- [ ] `seedTeams` exists for internal callers.
- [ ] Legacy team services are removed.

## Success Criteria

- All team CRUD routes behave the same as before.
- Events and Sync can later depend on the new Teams repository or use-cases instead of a legacy service.

## Risk Assessment

- Risk is lower than earlier phases, but search behavior can regress if query translation changes.

## Security Considerations

- Preserve any current write-route auth checks.
- Keep event-scoped operations event-scoped during repository extraction.

## Next Steps

- Events should consume the new Teams boundary instead of reaching back into legacy team service code.
