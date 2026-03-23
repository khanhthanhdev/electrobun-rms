# Phase 1: Server-Side SSE Broadcast

**Status:** Complete
**Priority:** High
**Blocks:** Phase 2

---

## Context

- **Parent Plan:** `plans/260315-1516-realtime-score-display/plan.md`
- **Related Files:**
  - `src/bun/server/api/display/display.routes.ts` - Main file to modify
  - `src/bun/server/api/display/display-sync.ts` - Types to extend
  - `src/bun/server/api/scoring/scoring-sync.ts` - Source of scoring events

---

## Overview

Extend the display SSE stream endpoint to subscribe to scoring events and forward them to display clients, enabling real-time score update notifications.

---

## Key Insights

1. `scoringSyncHub` already publishes `SCORE_UPDATED` events when scores are saved
2. Display stream uses `EventTarget` pattern for SSE client management
3. Need to add cleanup handler to unsubscribe when client disconnects
4. Event payload should be minimal (matchNumber, matchType, version) - no score data

---

## Requirements

### Functional
- FR1: Display SSE stream forwards `SCORE_UPDATED` events from scoring sync
- FR2: Subscription cleaned up when client disconnects
- FR3: Events include matchNumber and matchType for client filtering

### Non-Functional
- NFR1: No breaking changes to existing display event format
- NFR2: Minimal overhead on SSE stream performance
- NFR3: Graceful handling of scoring hub errors

---

## Architecture

### Modification Points

**File: `display.routes.ts`**

Current structure:
```typescript
export const GET = (request: Request) => {
  const { eventCode } = getPathParams(request);
  const eventTarget = new EventTarget();

  // Display sync subscription
  const displayUnsub = displaySyncHub.subscribe(eventCode, (event) => {
    // ... encode and send to client
  });

  // Return SSE stream
  return new Response(encode(), {
    signal: request.signal,
    // ...
  });
};
```

After modification:
```typescript
import { scoringSyncHub } from "../scoring/scoring-sync";

export const GET = (request: Request) => {
  const { eventCode } = getPathParams(request);
  const eventTarget = new EventTarget();

  // Display sync subscription
  const displayUnsub = displaySyncHub.subscribe(eventCode, (event) => {
    // ... existing code
  });

  // NEW: Scoring sync subscription
  const scoringUnsub = scoringSyncHub.subscribe(eventCode, (scoringEvent) => {
    const displayEvent = {
      changedAt: new Date().toISOString(),
      eventCode,
      kind: "SCORE_UPDATE" as const,
      matchNumber: scoringEvent.matchNumber,
      matchType: scoringEvent.matchType,
      version: scoringEvent.version,
    };

    eventTarget.dispatchEvent(
      new MessageEvent("message", {
        data: `event: ${DISPLAY_SYNC_EVENT_NAME}\ndata: ${JSON.stringify(displayEvent)}\n\n`,
      })
    );
  });

  // Cleanup
  request.signal.addEventListener("abort", () => {
    displayUnsub();
    scoringUnsub();  // NEW
  });

  // Return SSE stream
  return new Response(encode(), {
    signal: request.signal,
    // ...
  });
};
```

---

## Related Code Files

### To Modify
| File | Lines | Change |
|------|-------|--------|
| `src/bun/server/api/display/display.routes.ts` | All | Add scoring subscription, cleanup |
| `src/bun/server/api/display/display-sync.ts` | Types | Add `SCORE_UPDATE` to event kinds |

### No Change Required
| File | Reason |
|------|--------|
| `src/bun/server/api/scoring/scoring.routes.ts` | Already publishes events correctly |
| `src/bun/server/api/scoring/scoring-sync.ts` | Already has working hub |

---

## Implementation Steps

1. **Read current file** - Understand exact structure of `display.routes.ts`
2. **Add import** - `import { scoringSyncHub } from "../scoring/scoring-sync";`
3. **Add subscription** - Inside GET handler, after display subscription
4. **Add cleanup** - In abort handler, call `scoringUnsub()`
5. **Extend types** - Add `SCORE_UPDATE` to `DisplaySyncEventKind` in `display-sync.ts`
6. **Test manually** - Use curl or browser to verify SSE emits scoring events

---

## Success Criteria

- [ ] `scoringSyncHub.subscribe()` called in display stream handler
- [ ] `SCORE_UPDATE` events emitted to SSE clients
- [ ] Subscription cleaned up on disconnect
- [ ] No TypeScript errors
- [ ] Existing display tests pass

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Event loop blocked by too many subscriptions | Bun EventTarget is efficient; monitor under load |
| Memory leak if unsubscribe fails | Verify cleanup handler called on abort |
| Type mismatch between scoring/display events | Use minimal payload, validate at compile time |

---

## Security Considerations

- Event payload contains only metadata (matchNumber, matchType, version)
- Full scoresheet still requires authenticated fetch
- No new auth requirements introduced

---

## Next Steps

After completing Phase 1:
1. Move to Phase 2 - Client-side event listener
2. Or run quick manual test: `curl -N /api/{eventCode}/display/stream`
