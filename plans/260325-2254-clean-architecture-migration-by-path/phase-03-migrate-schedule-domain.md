# Phase 03: Migrate Schedule Domain

**Parent Plan:** `./plan.md`
**Priority:** 3
**Status:** Completed
**Effort:** 4-6 hours

## Context Links

- Parent path plan: [plan.md](./plan.md)
- Current schedule routes: `src/bun/server/api/schedule/schedule.routes.ts`
- Current schedule wrapper: `src/bun/server/api/schedule/schedule.service.ts`
- Current schedule service: `src/bun/server/services/event-schedule-service.ts`
- Season rules: `src/bun/server/domain/season-rules/*`

## Overview

Split Schedule into explicit practice and qualification use-cases without collapsing the route surface into a generic handler. Persistence and activation move to a repository; generation stays in application logic.

## Key Insights

- `event-schedule-service.ts` is the largest legacy file and carries both generation logic and persistence behavior.
- The route surface already distinguishes practice and qualification workflows, so the use-case layer should mirror that instead of hiding it behind one generic API.
- Schedule activation flags are infrastructure concerns and belong in the repository.

## Requirements

- Functional:
  - Preserve all practice and qualification routes, body contracts, and status codes.
  - Preserve schedule generation behavior and active-state semantics.
  - Keep season-rules-based match timing and format behavior intact.
- Non-functional:
  - Use-cases remain explicit by route behavior.
  - Repositories do not own schedule generation rules.
  - Clearing or regenerating one schedule type must not affect the other unexpectedly.

## Architecture

- `api/schedule/*.routes.ts` keeps route parsing and auth.
- `application/use-cases/schedule/*` owns list, create, clear, generate, and activate orchestration.
- `application/interfaces/schedule-repository.ts` owns schedule rows and activation state.
- `infrastructure/adapters/schedule/sqlite-schedule-repository.ts` owns event DB persistence.

## Related Code Files

- Modify:
  - `src/bun/server/api/schedule/schedule.routes.ts`
  - `src/bun/server/api/schedule/schedule.service.ts`
  - `src/bun/server/application/use-cases/schedule/index.ts`
  - `src/bun/server/domain/season-rules/*`
- Create:
  - `src/bun/server/application/dtos/schedule/index.ts`
  - `src/bun/server/application/interfaces/schedule-repository.ts`
  - `src/bun/server/application/use-cases/schedule/list-practice-matches.ts`
  - `src/bun/server/application/use-cases/schedule/create-practice-match.ts`
  - `src/bun/server/application/use-cases/schedule/delete-practice-match.ts`
  - `src/bun/server/application/use-cases/schedule/list-qualification-matches.ts`
  - `src/bun/server/application/use-cases/schedule/generate-qualification-schedule.ts`
  - `src/bun/server/application/use-cases/schedule/clear-qualification-schedule.ts`
  - `src/bun/server/application/use-cases/schedule/activate-schedule.ts`
  - `src/bun/server/infrastructure/adapters/schedule/sqlite-schedule-repository.ts`
- Delete:
  - `src/bun/server/api/schedule/schedule.service.ts`
  - `src/bun/server/services/event-schedule-service.ts`

## Implementation Steps

1. Lock current route behavior with practice and qualification parity tests.
2. Extract schedule DTOs for generation input, schedule entries, and status projections.
3. Define `ScheduleRepository` around load, save, clear, and activate operations.
4. Pull schedule generation orchestration into explicit use-cases backed by season rules.
5. Extract event DB persistence into `sqlite-schedule-repository.ts`.
6. Replace the route wrapper with direct use-case wiring.
7. Delete legacy schedule sources after verification.

## Todo List

- [ ] Practice and qualification route parity tests exist.
- [ ] Explicit schedule use-cases mirror the current route surface.
- [ ] Activation flags are repository-owned.
- [ ] Generation logic no longer lives in the legacy service.
- [ ] Legacy schedule files are removed.

## Success Criteria

- Schedule generation and editing behavior remain unchanged.
- Practice and qualification activation still work exactly as before.
- The schedule domain no longer depends on a monolithic service file.

## Risk Assessment

- Highest risk is subtle schedule generation drift from moving logic.
- Large-file extraction risk is high because the legacy service mixes several concerns.

## Security Considerations

- Preserve current route guards around write operations.
- Keep validation around schedule generation inputs to avoid malformed event data.

## Next Steps

- After Schedule is stable, move Inspection next because it also combines event DB bootstrapping and business behavior.
