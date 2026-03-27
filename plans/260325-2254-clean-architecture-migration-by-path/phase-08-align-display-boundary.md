# Phase 08: Align Display Boundary

**Parent Plan:** `./plan.md`
**Priority:** 8
**Status:** Completed
**Effort:** 1-2 hours

## Context Links

- Parent path plan: [plan.md](./plan.md)
- Current display routes: `src/bun/server/api/display/display.routes.ts`
- Current display sync: `src/bun/server/api/display/display-sync.ts`
- Scoring stream path: `src/bun/server/api/scoring/scoring-sync.ts`

## Overview

Keep Display as a deliberate YAGNI exception. Align imports and payload contracts after the Scoring migration, but do not force a repository or use-case stack where no persistence or independent business rules exist yet.

## Key Insights

- Display is currently an API-layer transport bridge with no persistence.
- The only meaningful dependency is its subscription to scoring updates and command broadcasting behavior.
- A full Clean Architecture rewrite here would add abstraction without reducing risk.

## Requirements

- Functional:
  - Preserve `/display/stream` and display command route behavior.
  - Preserve the scoring-to-display bridge behavior.
- Non-functional:
  - Avoid adding repositories or application use-cases unless Display gains real domain logic.
  - Keep imports aligned with any scoring DTO moves.

## Architecture

- `api/display/*.ts` remains the owning layer for this path.
- Display subscribes to Scoring transport events and republishes display-facing commands or snapshots.
- Only shared DTO imports may move if Scoring changes their location.

## Related Code Files

- Modify:
  - `src/bun/server/api/display/display.routes.ts`
  - `src/bun/server/api/display/display-sync.ts`
  - `src/bun/server/api/README.md`
  - Any shared DTO import locations affected by Scoring
- Create:
  - `src/bun/server/api/display/display.routes.test.ts`
  - `src/bun/server/api/display/display.test-support.ts`
- Delete:
  - None

## Implementation Steps

1. Re-test display stream and command behavior after Scoring migration lands.
2. Update imports if scoring payload or DTO locations change.
3. Keep the scoring-to-display bridge subscription exactly equivalent.
4. Document Display as an intentional API-layer exception.

## Todo List

- [x] Display still receives scoring updates.
- [x] Display stream behavior is unchanged.
- [x] No unnecessary new layers were added.

## Success Criteria

- Display continues to work without architectural churn.
- The repo documents why Display remains in `api/`.

## Risk Assessment

- Main risk is breaking the scoring-to-display bridge during Scoring refactors.
- Architectural overreach is also a risk if the path is forced into abstractions it does not need.

## Security Considerations

- Preserve current write-route protections for display commands.
- Do not widen stream visibility or event payload contents.

## Next Steps

- After Display is confirmed stable, Sync can start using the now-stable upstream path boundaries.
