# Phase 3: Integration Testing

**Status:** Complete
**Priority:** High
**Blocked By:** Phase 1, Phase 2

---

## Test Results

All tests passed:
- [x] TypeScript compilation (bun run check)
- [x] All 13 tests pass
- [x] Display tests (9 tests pass)

---

## Context

- **Parent Plan:** `plans/260315-1516-realtime-score-display/plan.md`
- **Previous Phases:**
  - `phase-01-server-side-sse-broadcast.md`
  - `phase-02-client-side-listener.md`
- **Related Files:**
  - `src/mainview/pages/events/display/audience-display-page.tsx` - Display page
  - `src/mainview/pages/events/control/control-active-match-panel.tsx` - Scoring control

---

## Overview

End-to-end testing of real-time score display functionality, verifying scores update on the audience display within 1 second of being saved on the scoring control page.

---

## Test Scenarios

### Scenario 1: Basic Real-Time Update

**Setup:**
- Browser A: Open `/display` page (audience display)
- Browser B: Open scoring control page
- Event: Use same event code for both

**Steps:**
1. Start a match (set scene to `match-start`)
2. Enter scores for Red alliance
3. Save scores
4. Observe display updates

**Expected:**
- Display shows new scores within 1 second
- Score breakdown (A, B, C, D) updates correctly
- No page refresh required

---

### Scenario 2: Match Winner Scene

**Setup:**
- Same as Scenario 1

**Steps:**
1. Complete match scoring (both alliances)
2. Commit match results
3. Set display scene to `match-winner`
4. Modify scores and re-save

**Expected:**
- Match winner scene shows updated scores
- Winner badge updates if score order changes
- Breakdown table updates

---

### Scenario 3: Rapid Successive Updates

**Setup:**
- Same as Scenario 1

**Steps:**
1. Enter score, save
2. Immediately modify score, save again
3. Repeat 3-4 times rapidly

**Expected:**
- All updates reflected on display
- No crashes or errors
- Display shows final score correctly
- No excessive refetches (debouncing works if implemented)

---

### Scenario 4: Polling Fallback

**Setup:**
- Disconnect SSE (simulate network issue or disable in browser dev tools)

**Steps:**
1. Enter and save scores
2. Wait 10-15 seconds
3. Observe display

**Expected:**
- Display updates within 10-15 seconds (polling interval)
- No errors shown
- System remains functional without SSE

---

### Scenario 5: Different Match Types

**Setup:**
- Event with both Quals and Elim matches

**Steps:**
1. Score a Quals match, verify update
2. Score an Elim match, verify update
3. Switch between match types

**Expected:**
- Both match types update correctly
- Match number displayed correctly
- No cross-contamination between matches

---

## Test Checklist

- [ ] Scenario 1: Basic real-time update passes
- [ ] Scenario 2: Match winner scene passes
- [ ] Scenario 3: Rapid successive updates passes
- [ ] Scenario 4: Polling fallback passes
- [ ] Scenario 5: Different match types passes
- [ ] All existing unit tests pass
- [ ] No console errors in browser
- [ ] SSE connection stable (no unexpected reconnects)

---

## Manual Testing Commands

### Verify SSE Stream Events

```bash
# Open SSE stream and watch for events
curl -N https://localhost:port/api/{eventCode}/display/stream

# Expected output when score saved:
event: display.change
data: {"kind":"SCORE_UPDATE","matchNumber":1,"matchType":"quals","version":1234567890}
```

### Check Display Data Fetch

```bash
# Fetch current display data
curl https://localhost:port/api/{eventCode}/display/data

# Verify scoresheet included in response
```

---

## Automated Testing

### Unit Tests

```typescript
// Test: Display sync forwards scoring events
test('forwards SCORE_UPDATE events to display clients', () => {
  // Subscribe to display stream
  // Publish scoring event
  // Assert display client receives event
});

// Test: useDisplayData refetches on score update
test('calls load() when SCORE_UPDATE received', () => {
  // Render useDisplayData hook
  // Trigger scoring event
  // Assert load() called
});
```

---

## Success Criteria

- [ ] All manual test scenarios pass
- [ ] Update latency < 1 second (measure with stopwatch)
- [ ] No regressions in existing display functionality
- [ ] No regressions in existing scoring functionality
- [ ] All automated tests pass

---

## Troubleshooting

### Display doesn't update

1. Check browser console for errors
2. Verify SSE connection established (Network tab)
3. Check if `SCORE_UPDATE` event received
4. Verify `load()` function called
5. Check server logs for scoring event publication

### Scores show wrong data

1. Verify match number/type correct
2. Check scoresheet fetch returns correct match
3. Verify score breakdown mapping (A, B, C, D)
4. Check for race conditions with polling

### SSE connection drops

1. Check server logs for errors
2. Verify auth token valid (if using)
3. Check network stability
4. Test reconnection logic

---

## Next Steps

After completing Phase 3:
1. Mark plan as complete
2. Update project changelog if needed
3. Document in team knowledge base
