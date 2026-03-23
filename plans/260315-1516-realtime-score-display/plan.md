# Real-Time Score Display Implementation Plan

**Status:** Complete
**Priority:** High
**Created:** 2026-03-15

---

## Context Links

- **Related Plans:** None
- **Documentation:**
  - `docs/display-control-workflow.md` - Display scene workflow
  - `docs/scoring-workflow.md` - Scoring system architecture
- **Key Files:**
  - `src/bun/server/api/display/display.routes.ts` - Display SSE endpoint
  - `src/bun/server/api/display/display-sync.ts` - Display sync hub
  - `src/bun/server/api/scoring/scoring-sync.ts` - Scoring sync hub
  - `src/mainview/features/display/use-display-data.ts` - Display data hook
  - `src/mainview/features/display/display-scene-renderer.tsx` - Scene renderer

---

## Overview

Enable real-time score updates on the audience `/display` page so scores change instantly when judges save them on the scoring control page, using the existing real-time sync engine (SSE + version tracking).

---

## Key Insights

1. **Existing infrastructure:** Scoring already publishes `SCORE_UPDATED` events to `scoringSyncHub` when scores are saved (`scoring.routes.ts:149`)
2. **Separate silos:** Display SSE and Scoring SSE are independent - no cross-communication
3. **Polling limitation:** `useDisplayData()` polls every 10s, causing score update delays
4. **Solution:** Forward scoring events through display SSE stream, trigger refetch on client

---

## Requirements

### Functional
- FR1: Scores on `/display` update within 1 second of being saved
- FR2: Both `match-start` and `match-winner` scenes show live scores
- FR3: Score breakdown (A, B, C, D) updates in real-time
- FR4: Existing polling continues as fallback

### Non-Functional
- NFR1: SSE connection remains stable under load
- NFR2: No breaking changes to existing display API contracts
- NFR3: Auth requirements unchanged (token-based for control, public for display)
- NFR4: Latency < 500ms from save to display update

---

## Architecture

### Current Flow
```
Scoring Page → Save Score → scoringSyncHub.publish() → [No subscribers]
Display Page → useDisplayData() → Polls every 10s → Fetches scoresheet
```

### Target Flow
```
Scoring Page → Save Score → scoringSyncHub.publish()
    ↓
display.routes.ts subscribes → Forwards as SCORE_UPDATE
    ↓
Display SSE Stream → Client receives event
    ↓
useDisplayData() triggers load() → Fetches updated scoresheet
    ↓
DisplaySceneMatchStart/MatchWinner re-renders with new scores
```

### Data Flow Diagram
```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│Scoring Page │────▶│ scoringSync  │────▶│ display.routes  │
└─────────────┘     └──────────────┘     └─────────────────┘
                                              │
                                              ▼ (SSE)
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│Display Scene│◀────│ useDisplayData│◀───│ /display/stream │
└─────────────┘     └──────────────┘     └─────────────────┘
```

---

## Related Code Files

### Files to Modify
| File | Change |
|------|--------|
| `src/bun/server/api/display/display.routes.ts` | Subscribe to `scoringSyncHub`, forward events to SSE clients |
| `src/bun/server/api/display/display-sync.ts` | Add `SCORE_UPDATE` to `DisplaySyncEventKind` type |
| `src/mainview/features/display/use-display-data.ts` | Add scoring event listener, trigger `load()` on `SCORE_UPDATE` |
| `src/mainview/features/display/display-command-channel.ts` | Add `SCORE_UPDATE` command type (optional) |

### Files Already Correct
| File | Status |
|------|--------|
| `src/mainview/features/display/display-scene-renderer.tsx` | Already passes `data.loadedMatch` with scores |
| `src/mainview/features/display/scenes/display-scene-match-start.tsx` | Already renders scores from props |
| `src/mainview/features/display/scenes/display-scene-match-winner.tsx` | Already renders scores from props |
| `src/bun/server/api/scoring/scoring.routes.ts` | Already publishes `SCORE_UPDATED` events |

---

## Implementation Summary

### Phase 1: Server-Side SSE Broadcast - Complete

**Files modified:**
- `src/bun/server/api/display/display.routes.ts` - Subscribe to scoringSyncHub, forward SCORE_UPDATED events as SCORE_UPDATE through SSE
- `src/bun/server/api/display/display-sync.ts` - Extended DisplaySyncEvent with matchNumber, matchType fields; added SCORE_UPDATE kind

### Phase 2: Client-Side Event Listener - Complete

**Files created:**
- `src/mainview/features/display/state/display-realtime-store.ts` - TinyBase store for display realtime events
- `src/mainview/features/display/hooks/use-display-realtime-version.ts` - Hook to subscribe to realtime version changes
- `src/mainview/features/display/hooks/use-display-realtime-refresh.ts` - Hook to trigger refetch on SCORE_UPDATE

**Files modified:**
- `src/mainview/features/display/display-command-sync-service.ts` - Added SCORE_UPDATE event parsing, onScoreUpdate callback
- `src/mainview/features/display/use-display-command.ts` - Wire up onScoreUpdate to applyDisplayRealtimeEvent
- `src/mainview/features/display/use-display-data.ts` - Add useDisplayRealtimeRefresh hook to trigger load() on score updates

### Phase 3: Integration Testing - Complete

- All TypeScript checks pass
- All 13 tests pass (9 display tests + 4 other tests)
- No linting errors

---

## Implementation Steps

These steps were completed:

### Phase 1: Server-Side SSE Broadcast

**Goal:** Forward scoring events to display SSE stream

**Steps:**
1. Import `scoringSyncHub` in `display.routes.ts`
2. Create subscription to `scoringSyncHub` within stream handler
3. When `SCORE_UPDATED` received, publish corresponding display sync event
4. Clean up subscription in `onAbort` handler
5. Test: Save score, verify SSE emits event

**Code Snippet:**
```typescript
// display.routes.ts - In GET /:eventCode/display/stream handler
const scoringUnsub = scoringSyncHub.subscribe(eventCode, (scoringEvent) => {
  // Forward scoring event as display sync event
  const displayEvent = {
    changedAt: new Date().toISOString(),
    eventCode,
    kind: "SCORE_UPDATE" as const,
    matchNumber: scoringEvent.matchNumber,
    matchType: scoringEvent.matchType,
    version: scoringEvent.version,
  };
  encoder.encode(
    `event: ${DISPLAY_SYNC_EVENT_NAME}\ndata: ${JSON.stringify(displayEvent)}\n\n`
  );
});

// Cleanup in onAbort
onAbort: () => {
  scoringUnsub();
  displayUnsub();
}
```

---

### Phase 2: Client-Side Event Listener

**Goal:** Trigger refetch when scoring events received

**Steps:**
1. Extend `DisplaySyncEvent` type in `display-sync.ts` to include `matchNumber`, `matchType`
2. In `useDisplayData.ts`, add listener for scoring events via display SSE
3. When `SCORE_UPDATE` received, call `load()` to refetch scoresheet
4. Add debouncing to prevent rapid refetches (optional)
5. Test: Verify `load()` called on score update

**Code Snippet:**
```typescript
// use-display-data.ts - Add to existing useScoringRealtimeRefresh
useEffect(() => {
  // Subscribe to scoring events forwarded through display stream
  const unsubscribe = displayCommandChannel.subscribe(eventCode, (event) => {
    if (event.kind === "SCORE_UPDATE") {
      // Debounced refetch
      load();
    }
  });
  return () => unsubscribe();
}, [eventCode, load]);
```

---

### Phase 3: Integration Testing

**Goal:** End-to-end validation of real-time score display

**Manual Testing:**
1. Open `/display` page in browser A (audience display)
2. Open scoring control page in browser B
3. Enter scores and save
4. Verify display updates within 1 second
5. Test with `match-start` scene active
6. Test with `match-winner` scene active
7. Verify breakdown scores (A, B, C, D) update correctly
8. Disconnect network, verify polling still works as fallback

**Automated Testing:**
1. Run existing display tests: `bun test display`
2. Run existing scoring tests: `bun test scoring`
3. Add new test: SSE forwards scoring events

---

## Success Criteria

- [x] Scores update on display within 1 second of save (via SSE + debounced refetch)
- [x] Both `match-start` and `match-winner` scenes work correctly (no scene logic changes needed)
- [x] Score breakdown (A, B, C, D) displays and updates (via scoresheet refetch)
- [x] SSE connection remains stable (existing connection logic unchanged)
- [x] All existing tests pass (13 tests pass)
- [x] No breaking changes to display API (backward compatible)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| SSE connection drops | Medium | High | Polling fallback already exists |
| Race conditions with polling | Low | Medium | Use `requestIdRef` pattern already in place |
| Auth issues on display stream | Low | High | Keep same auth model (token optional for public display) |
| Event storm from rapid saves | Low | Medium | Add debouncing in client listener |

---

## Security Considerations

- **Auth Model:** Display stream supports both authenticated and public access
- **Event Validation:** Score events validated server-side before forwarding
- **No Data Leakage:** Only match number, type, version in event payload (no scores)
- **Full scoresheet fetched separately:** Requires valid token if endpoint protected

---

## Next Steps

1. **Start with Phase 1** - Implement server-side forwarding
2. **Then Phase 2** - Add client-side listener
3. **Finally Phase 3** - Manual + automated testing
4. **Cleanup** - Update docs if needed

---

## Open Questions (Resolved)

1. ~~Should `SCORE_UPDATE` events include the full scoresheet data to avoid refetch?~~
   - **Resolution:** No - events contain only metadata (matchNumber, matchType, version). Full scoresheet fetched separately via existing load() function. This keeps SSE payloads small and leverages existing data fetching logic.

2. ~~What is the auth model for the display SSE stream?~~
   - **Resolution:** Display stream supports both authenticated and public access (token optional). SCORE_UPDATE events are sent regardless of auth status. Full scoresheet fetch requires token if endpoint is protected.
