# Phase 1 Report: Fix Critical Workflow Mapping

**Date**: 2026-03-11
**Status**: Complete
**Time Spent**: ~1 hour

## Summary

Phase 1 successfully fixed the critical workflow mapping bugs where control page actions were sending incorrect scene IDs to the audience display.

## Changes Made

### Files Created

1. **`src/mainview/pages/events/control/display-action-to-scene-map.ts`** (48 lines)
   - Extracted action-to-scene mapping logic
   - Exports `getSceneForAction()` function
   - Defines `DisplayControlAction` type
   - Maps 9 control actions to their correct scene IDs

2. **`src/mainview/pages/events/control/display-action-to-scene-map.test.ts`** (42 lines)
   - 9 test cases covering all action mappings
   - All tests passing

### Files Modified

1. **`src/mainview/pages/events/control/event-control-page.tsx`**
   - Imported `getSceneForAction` helper
   - Updated `handleShowPreview`: now sends `"next-match"` (was `"match-preview"`)
   - Updated `handleShowMatch`: now sends `"match-preview"` (was `"match-start"`)
   - Updated `handleStartMatch`: uses helper for `"match-start"`
   - Updated `handleAbortMatch`: uses helper for `"blank"`
   - Updated `handleCommitMatch`: uses helper for `"match-winner"`
   - Updated all display mode buttons in Settings panel to use helper

## Bug Fixes

| Action | Before | After |
|--------|--------|-------|
| Show Preview | `match-preview` | `next-match` |
| Show Match | `match-start` | `match-preview` |

These fixes align the implementation with the workflow spec in `docs/display-control-workflow.md`.

## Verification

- **Build**: Passes (`bun run build`)
- **Linting**: Passes (`bun run check`)
- **Tests**: 9/9 passing (`bun test`)

## Architecture Improvements

- Removed inline scene ID string duplication
- Single source of truth for action-to-scene mapping
- Testable mapping logic isolated from page component
- Foundation for Phase 2 shared contract

## Next Steps (Phase 2)

Phase 2 will centralize the display contract by:
1. Creating `src/shared/display/` module
2. Defining all 17 scene IDs in one place
3. Adding Valibot schemas for intents, snapshots, and stream events
4. Migrating server and client to shared contract
5. Removing duplicated unions

## Unresolved Questions

None for Phase 1 scope.
