# Phase 01: Migrate Scoring Domain

**Parent Plan:** `./plan.md`
**Priority:** 1
**Status:** Completed
**Effort:** 4-6 hours

## Context Links

- Parent path plan: [plan.md](./plan.md)
- Folder structure plan: [../260325-2234-clean-architecture-folder-structure/plan.md](../260325-2234-clean-architecture-folder-structure/plan.md)
- Current migration snapshot: [../260325-2234-clean-architecture-folder-structure/phase-01-domain-migration-plan.md](../260325-2234-clean-architecture-folder-structure/phase-01-domain-migration-plan.md)
- Current route layer: `src/bun/server/api/scoring/*`
- Current legacy service: `src/bun/server/services/event-scoring-service.ts`

## Overview

Finish the first real Clean Architecture cutover by moving Scoring orchestration into `application/use-cases/scoring`, data access into `infrastructure/adapters/scoring`, and leaving `api/scoring` as a thin HTTP and SSE layer.

## Key Insights

- `event-scoring-service.ts` mixes DTO exports, season-rule logic, event DB access, and response shaping.
- `api/scoring/scoring.service.ts` is only a thin wrapper and should disappear in the first cutover.
- The scoring stream and `SCORE_UPDATED` publish flow are already stable and must stay byte-compatible at the transport level.
- DTO scaffolding already exists, so this phase should reuse that base instead of inventing a new type layout.

## Requirements

- Functional:
  - Preserve all current scoring routes and response bodies.
  - Preserve `SCORING_SYNC_EVENT_NAME`, `/scoring/stream`, and post-save `SCORE_UPDATED` publishing.
  - Support save score, match results, match history, and match scoresheet reads through use-cases.
- Non-functional:
  - No direct DB work remains in application or route code.
  - Shared application errors replace `ServiceError` usage in migrated scoring code.
  - New code follows the flat interface convention.

## Architecture

- `api/scoring/*.routes.ts` validates input, checks auth, invokes use-cases, and publishes SSE.
- `application/use-cases/scoring/*` orchestrates validation, season rules, and repository calls.
- `application/interfaces/scoring-repository.ts` defines the persistence contract.
- `infrastructure/adapters/scoring/sqlite-scoring-repository.ts` owns event DB and SQLite access.

## Related Code Files

- Modify:
  - `src/bun/server/application/dtos/scoring/*`
  - `src/bun/server/application/interfaces/scoring-repository.ts`
  - `src/bun/server/application/use-cases/scoring/index.ts`
  - `src/bun/server/api/scoring/scoring.routes.ts`
  - `src/bun/server/api/scoring/scoring-sync.ts`
- Create:
  - `src/bun/server/application/common/application-error.ts`
  - `src/bun/server/application/use-cases/scoring/submit-alliance-score.ts`
  - `src/bun/server/application/use-cases/scoring/get-match-results.ts`
  - `src/bun/server/application/use-cases/scoring/get-match-history.ts`
  - `src/bun/server/application/use-cases/scoring/get-match-scoresheet.ts`
  - `src/bun/server/infrastructure/adapters/scoring/sqlite-scoring-repository.ts`
- Delete:
  - `src/bun/server/api/scoring/scoring.service.ts`
  - `src/bun/server/services/event-scoring-service.ts`

## Implementation Steps

1. Add route parity tests and SSE tests that lock current Scoring behavior.
2. Finish DTO extraction under `application/dtos/scoring`, including `MatchResultItem` and save-score output types.
3. Expand `ScoringRepository` to cover save, scoresheet, history, and results operations.
4. Implement four scoring use-cases, pushing pure orchestration and validation out of the legacy service.
5. Implement `sqlite-scoring-repository.ts` by extracting event DB access from `event-scoring-service.ts`.
6. Rewire `scoring.routes.ts` to instantiate the repository and use-cases directly, then keep SSE publish behavior unchanged.
7. Remove `scoring.service.ts`, delete the legacy service, and rerun verification.

## Todo List

- [x] Route parity tests exist for all scoring endpoints.
- [x] SSE tests cover stream creation, heartbeat, and `SCORE_UPDATED`.
- [x] DTO exports no longer depend on `event-scoring-service.ts`.
- [x] `ScoringRepository` matches the full scoring route surface.
- [x] All scoring routes use use-cases instead of the legacy wrapper.
- [x] Legacy scoring service files are deleted.

## Success Criteria

- All scoring endpoints return the same status codes and payload shapes as before.
- Score writes still trigger the same SSE event flow.
- Scoring logic is split cleanly across route, use-case, and adapter layers.
- No new migration-specific TypeScript errors are introduced.

## Risk Assessment

- Highest risk is hidden behavior embedded in response shaping from the legacy service.
- SSE regression risk is medium because publish timing matters.
- DTO drift risk is medium because types are currently split across service exports and scaffolding.

## Security Considerations

- Preserve current auth guards on scoring writes.
- Keep route-level input validation in place before use-case invocation.
- Do not widen access to match history or scoresheet reads while rewiring.

## Next Steps

- Document any scoring-specific patterns that Ranking can reuse.
- After Scoring is green, move to Ranking and keep scoring result contracts stable.
