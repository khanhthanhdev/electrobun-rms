# Phase 2 Report: Centralize Display Contract

**Date**: 2026-03-11
**Status**: Complete
**Time Spent**: ~1.5 hours

## Summary

Phase 2 successfully centralized the display contract by creating a shared module that serves as the single source of truth for all 17 display scene IDs, schemas, and types.

## Changes Made

### Files Created

1. **`src/shared/display/display-scene-ids.ts`** (38 lines)
   - `DISPLAY_SCENE_IDS` constant array with all 17 scene IDs
   - `DisplaySceneId` type derived from the array
   - `isValidDisplaySceneId()` helper for runtime validation

2. **`src/shared/display/display-schemas.ts`** (142 lines)
   - `displaySceneModeSchema` - Union schema for all 17 scenes
   - `displayIntentSchema` - Command from control page
   - `displayMatchRefSchema` - Match reference structure
   - `displayScenePayloadSchema` - Typed scene-specific payloads
   - `displaySessionSnapshotSchema` - Authoritative render state
   - `displayStreamEventSchema` - SSE envelope

3. **`src/shared/display/display-types.ts`** (46 lines)
   - TypeScript types derived from Valibot schemas
   - `DisplaySceneMode`, `DisplayIntent`, `DisplaySessionSnapshot`, etc.

4. **`src/shared/display/index.ts`** (37 lines)
   - Barrel file for clean imports
   - Re-exports all scene IDs, schemas, and types

### Files Modified

1. **`tsconfig.json`**
   - Added `@shared/*` path alias pointing to `src/shared/*`

2. **`src/bun/server/api/display/display.schema.ts`**
   - Removed local scene ID union (9 scenes)
   - Now imports `displaySceneModeSchema` from shared contract

3. **`src/bun/server/api/display/display-sync.ts`**
   - Removed local `DisplaySceneMode` type
   - Now imports type from shared contract

4. **`src/mainview/features/display/display-scene-types.ts`**
   - Removed local scene ID union (9 scenes)
   - Now re-exports `DisplaySceneMode` from shared contract

## Scene Coverage

| Category | Scenes | Status |
|----------|--------|--------|
| Match lifecycle | `next-match`, `match-preview`, `match-start`, `match-winner` | Defined |
| Utility | `blank`, `text-notification` | Defined |
| Event info | `wifi-reminder`, `audience-key`, `safety-security`, `online-results-info` | Defined |
| Content | `sponsors`, `slideshow`, `video-overlay` | Defined |
| Tables/Competition | `ranking-result`, `robot-inspection-status`, `bracket`, `alliance-selection` | Defined |

**Total**: 17/17 scenes defined in shared contract (previously only 9 in code)

## Verification

- **Build**: Vite build passes (`bun run vite build`)
- **Linting**: Passes (`bun run check`)
- **Tests**: 9/9 passing (`bun test`)

## Architecture Improvements

- Single source of truth for display scene IDs
- No more duplicated scene unions across server and client
- Schema-backed types for runtime validation
- Foundation for server-authoritative display sessions (Phase 3)
- Type-safe intent and snapshot contracts

## Next Steps (Phase 3)

Phase 3 will introduce server-authoritative display session state:
1. Create `DisplaySessionService` for per-event display state
2. Add intent handlers (`loadMatch`, `showPreview`, `showMatch`, etc.)
3. Publish typed snapshots after every intent
4. Add `GET /api/events/:eventCode/display/state` endpoint
5. Update SSE publishing to emit canonical snapshot envelopes

## Unresolved Questions

None for Phase 2 scope.
