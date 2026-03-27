# Phase 02: Migrate Ranking Domain

**Parent Plan:** `./plan.md`
**Priority:** 2
**Status:** Completed
**Effort:** 2-4 hours

## Context Links

- Parent path plan: [plan.md](./plan.md)
- Scoring phase: [phase-01-migrate-scoring-domain.md](./phase-01-migrate-scoring-domain.md)
- Current ranking service: `src/bun/server/services/event-rankings-service.ts`
- Current ranking transport: `src/bun/server/api/events/rankings-sync.ts`
- Current ranking routes: `src/bun/server/api/events/events.routes.ts`

## Overview

Move qualification ranking reads and rebuilds into the Ranking application path while keeping the transport surface under `/events/:eventCode/qualification-rankings*`.

## Key Insights

- Ranking logic is already closer to pure domain math than several other paths.
- Ranking endpoints are hosted inside `api/events`, but the business logic belongs to the Ranking path.
- Repository code should read and write ranking inputs and outputs only; ranking calculation itself stays in application logic.

## Requirements

- Functional:
  - Preserve `GET /:eventCode/qualification-rankings`.
  - Preserve `POST /:eventCode/qualification-rankings/rebuild`.
  - Preserve the ranking stream and `RANKINGS_UPDATED`.
- Non-functional:
  - Ranking computation must not live in the repository.
  - Ranking rules continue to use `domain/season-rules/ranking`.
  - Fingerprint logic stays stable so rebuild invalidation does not regress.

## Architecture

- `api/events/events.routes.ts` keeps the current URLs.
- `application/use-cases/ranking/*` owns rebuild orchestration and ranking math.
- `application/interfaces/ranking-repository.ts` owns posted results, stored rankings, and source fingerprint persistence.
- `infrastructure/adapters/ranking/sqlite-ranking-repository.ts` owns data access.

## Related Code Files

- Modify:
  - `src/bun/server/api/events/events.routes.ts`
  - `src/bun/server/api/events/events.service.ts`
  - `src/bun/server/api/events/rankings-sync.ts`
  - `src/bun/server/application/use-cases/ranking/index.ts`
- Create:
  - `src/bun/server/application/dtos/ranking/index.ts`
  - `src/bun/server/application/interfaces/ranking-repository.ts`
  - `src/bun/server/application/use-cases/ranking/get-qualification-rankings.ts`
  - `src/bun/server/application/use-cases/ranking/rebuild-qualification-rankings.ts`
  - `src/bun/server/infrastructure/adapters/ranking/sqlite-ranking-repository.ts`
- Delete:
  - `src/bun/server/services/event-rankings-service.ts`
  - Ranking-related logic inside `src/bun/server/api/events/events.service.ts`

## Implementation Steps

1. Add parity tests for ranking read, rebuild, and stream behavior.
2. Extract ranking DTOs and fingerprint types into `application/dtos/ranking`.
3. Define `RankingRepository` with explicit load and replace methods, not a `computeRankings` shortcut.
4. Move ranking accumulation and sorting orchestration into application use-cases.
5. Extract storage operations into `sqlite-ranking-repository.ts`.
6. Rewire events routes to use the new use-cases and keep ranking SSE unchanged.
7. Delete the legacy ranking service once tests and TypeScript checks pass.

## Todo List

- [x] Ranking DTOs and fingerprint type exist in the application layer.
- [x] `RankingRepository` owns persistence only.
- [x] Ranking rebuild path publishes `RANKINGS_UPDATED`.
- [x] Ranking logic is removed from the legacy service and events service wrapper.

## Success Criteria

- Ranking endpoints and SSE behavior remain unchanged.
- Ranking calculation lives outside the repository.
- Rebuilds still produce the same ordering and change detection behavior.

## Risk Assessment

- Main risk is subtle ranking-order drift from refactoring tie-break logic.
- Secondary risk is storing or comparing fingerprints differently than current behavior.

## Security Considerations

- Preserve existing event-level auth and access patterns on rebuild routes.
- Keep any admin-only rebuild restrictions at the route layer.

## Next Steps

- Keep the Ranking route surface inside `api/events`.
- After Ranking is stable, use the same repository and use-case separation pattern for Schedule.
