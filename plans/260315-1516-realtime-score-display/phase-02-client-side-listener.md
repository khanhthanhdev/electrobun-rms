# Phase 2: Client-Side Event Listener

**Status:** Complete
**Priority:** High
**Blocked By:** Phase 1
**Blocks:** Phase 3

---

## Context

- **Parent Plan:** `plans/260315-1516-realtime-score-display/plan.md`
- **Previous Phase:** `phase-01-server-side-sse-broadcast.md`
- **Related Files:**
  - `src/mainview/features/display/use-display-data.ts` - Main file to modify
  - `src/mainview/features/display/display-command-channel.ts` - Event types
  - `src/mainview/features/display/display-command-sync-service.ts` - SSE client

---

## Overview

Extend the `useDisplayData` hook to listen for scoring events from the display SSE stream and trigger immediate refetch when scores are updated.

---

## Key Insights

1. `useDisplayData` already has a `load()` function that fetches all display data including scoresheets
2. Current polling interval is 10s (with token) or 5s (public)
3. `useScoringRealtimeRefresh` already exists for similar pattern
4. Need to avoid race conditions between poll and event-triggered refetch

---

## Requirements

### Functional
- FR1: `load()` called immediately when `SCORE_UPDATE` event received
- FR2: Existing polling continues as fallback
- FR3: Works for both authenticated and public display modes

### Non-Functional
- NFR1: No unnecessary re-renders
- NFR2: Debounce rapid successive events (optional)
- NFR3: Maintain existing `requestIdRef` pattern for race condition prevention

---

## Architecture

### Current Flow
```
useDisplayData() → load() → fetchAllDisplaySources() → setData()
     ↓
  Poll every 10s
```

### After Modification
```
useDisplayData() → load() → fetchAllDisplaySources() → setData()
     ↓                              ▲
  Poll every 10s                    │
     ↓                              │
  SSE listener ────── SCORE_UPDATE ─┘
```

### Code Structure

**File: `use-display-data.ts`**

Current structure:
```typescript
export const useDisplayData = (eventCode: string, token: string | null): DisplayData => {
  const [data, setData] = useState<DisplayData>(emptyDisplayData);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    // ... fetch and setData
  }, [eventCode, token]);

  useScoringRealtime(eventCode, token);
  useScoringRealtimeRefresh(eventCode, load);

  useEffect(() => {
    load();
    const pollMs = token ? 10_000 : 5000;
    const id = window.setInterval(load, pollMs);
    return () => {
      window.clearInterval(id);
    };
  }, [load, token]);

  return data;
};
```

After modification (option A - extend useScoringRealtimeRefresh):
```typescript
// Option A: Modify useScoringRealtimeRefresh to also listen for display events
// This assumes useScoringRealtimeRefresh already handles SSE subscription

export const useDisplayData = (eventCode: string, token: string | null): DisplayData => {
  // ... existing code

  useScoringRealtime(eventCode, token);
  useScoringRealtimeRefresh(eventCode, load); // Already subscribes to scoring events

  // ... existing code
};
```

**Wait - analysis shows `useScoringRealtimeRefresh` connects to SCORING SSE, not DISPLAY SSE.**

We need to either:
1. Create new hook `useDisplayScoringEventListener` for display SSE
2. Or modify server to ensure scoring events are forwarded through display SSE

**Correct approach after Phase 1:**

After Phase 1, scoring events flow through DISPLAY SSE stream. So we need to:

1. Extend `useDisplayCommand` hook to expose scoring events
2. Or add direct subscription in `useDisplayData` to the display command channel

**Recommended: Extend `useDisplayCommand`**

```typescript
// display-command-channel.ts - Add scoring event type
export type DisplaySyncEvent = {
  kind: "COMMAND_ISSUED" | "SCORE_UPDATE";
  mode: DisplaySceneMode | null;
  matchNumber: number | null;
  matchType: string | null;
  // ...
};

// use-display-command.ts - Already subscribes to display SSE, just expose new event type
// The existing subscription already receives all events from the stream

// use-display-data.ts - No change needed if useDisplayCommand already handles it
// OR add explicit listener:
useEffect(() => {
  const unsubscribe = displayCommandChannel.subscribe(eventCode, (event) => {
    if (event.kind === "SCORE_UPDATE") {
      load();
    }
  });
  return () => unsubscribe();
}, [eventCode, load]);
```

---

## Related Code Files

### To Modify
| File | Change |
|------|--------|
| `src/mainview/features/display/use-display-data.ts` | Add scoring event listener, trigger load() |
| `src/mainview/features/display/display-command-channel.ts` | Add `SCORE_UPDATE` to event types |

### To Review
| File | Reason |
|------|--------|
| `src/mainview/features/display/use-display-command.ts` | Verify if already handles scoring events from display stream |
| `src/mainview/features/display/display-command-sync-service.ts` | Check SSE event parsing logic |

---

## Implementation Steps

1. **Read `use-display-command.ts`** - Understand current event handling
2. **Extend types** - Add `SCORE_UPDATE` to display command types
3. **Add listener** - In `useDisplayData`, subscribe to scoring events
4. **Trigger refetch** - Call `load()` when `SCORE_UPDATE` received
5. **Test** - Verify `load()` called on event (console.log for debugging)
6. **Optional debouncing** - Add if rapid events cause issues

---

## Success Criteria

- [ ] `SCORE_UPDATE` type added to display command types
- [ ] `useDisplayData` subscribes to scoring events
- [ ] `load()` called when scoring event received
- [ ] Existing polling still works
- [ ] No TypeScript errors
- [ ] Scores update on display within 1-2 seconds

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Race condition between poll and event refetch | `requestIdRef` pattern already handles this |
| Event storm causes excessive refetches | Add 100ms debounce if needed |
| Subscription leak | Proper cleanup in useEffect return |

---

## Security Considerations

- No new security concerns
- Auth model unchanged from Phase 1
- Event validation happens server-side

---

## Next Steps

After completing Phase 2:
1. Move to Phase 3 - Integration testing
2. Test end-to-end: scoring page → display page
