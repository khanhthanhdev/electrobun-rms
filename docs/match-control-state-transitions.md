# Match Control State Transitions — Best Practices

## State Model

The match control state machine uses **two independent slots**:

| Slot | States | Purpose |
|------|--------|---------|
| **Loaded** (staging) | `IDLE` → `LOADED` → `PREVIEW` → `READY` | Queue & prepare next match |
| **Active** (live) | `IDLE` → `IN_PROGRESS` → `COMPLETED` | Execute & finish running match |

**Invariant:** Only one slot is non-IDLE at a time. `START` atomically moves the match from loaded→active.

---

## Transition Map

```
  ┌─────────────────────── LOADED SLOT ───────────────────────┐
  │                                                           │
  │  IDLE ──LOAD──▶ LOADED ──SHOW_PREVIEW──▶ PREVIEW          │
  │   ▲               │                        │              │
  │   │             UNLOAD                  SHOW_MATCH        │
  │   │               │                        │              │
  │   ◀───────────────┘                        ▼              │
  │   ▲                                      READY            │
  │   │                                        │              │
  └───┼────────────────────────────────────────┼──────────────┘
      │                                        │
      │                                      START
      │                                        │
  ┌───┼──────────────── ACTIVE SLOT ───────────┼──────────────┐
  │   │                                        ▼              │
  │   │◀──COMMIT── COMPLETED ◀──AUTO_COMPLETE── IN_PROGRESS   │
  │   │                                           │           │
  │   │                                         ABORT         │
  │   │                                           │           │
  │   │                      (match returns to LOADED slot)   │
  └───┼───────────────────────────────────────────────────────┘
      │
   Both IDLE → ready for next LOAD
```

---

## Golden Rules

### 1. Always UNLOAD before LOAD

You **cannot** load a new match while a match is already staged. The sequence is always:

```
UNLOAD current → LOAD new
```

The `LOAD` guard rejects if `activeState !== "IDLE"`, but does **not** reject if `loadedState` is non-IDLE — it overwrites the staged match. If you want a clean swap, always UNLOAD first.

### 2. Active match must be cleared before loading

If a match is running or completed, you must clear the active slot first:

| Active State | Required Action | Then |
|---|---|---|
| `IN_PROGRESS` | `ABORT` → match returns to `LOADED` | `UNLOAD` → `LOAD new` |
| `COMPLETED` | `COMMIT` → results saved, active=IDLE | `LOAD new` |
| `IDLE` | No action needed | `LOAD new` |

**Never attempt LOAD when `activeState !== "IDLE"`** — the server returns `INVALID_TRANSITION`.

### 3. Follow the linear staging pipeline

```
LOAD → SHOW_PREVIEW → SHOW_MATCH → START
```

- No skipping steps. `SHOW_PREVIEW` requires `loadedState === "LOADED"`.
- `SHOW_MATCH` requires `loadedState === "PREVIEW"`.
- `START` requires `loadedState === "READY"` **and** `activeState === "IDLE"`.

### 4. Use optimistic concurrency (`expectedVersion`)

Every client command (except `AUTO_COMPLETE`) must include `expectedVersion`. The server rejects with `409 STATE_CONFLICT` if stale.

```typescript
// Client pattern
const { version } = await getState();
await postTransition("start", { expectedVersion: version });
```

On conflict: **re-fetch state**, update UI, then let the operator decide.

### 5. ABORT returns match to LOADED (not IDLE)

After abort, the match is placed back in the loaded slot as `LOADED`. This allows the operator to re-prepare and re-start without re-loading from the schedule.

```
IN_PROGRESS ──ABORT──▶ loaded=LOADED, active=IDLE
                       (match ref moved from activeMatch → loadedMatch)
```

Side effects on ABORT:
- Auto-complete timer is cancelled.
- Saved scores are cleared (match replays from zero).

### 6. COMMIT clears the active slot entirely

After commit, `activeMatch` and `activeStartedAtMs` are set to `null`. The pre-transition active match is passed to the display bridge for the winner scene.

```
COMPLETED ──COMMIT──▶ loaded=IDLE, active=IDLE
                      (display shows "match-winner" using committed match data)
```

---

## Display Mode by Transition

| Command | Display Mode | Notes |
|---------|-------------|-------|
| `LOAD` | Preserves current (or `blank`) | No scene change — just data update |
| `UNLOAD` | `blank` | Clears display |
| `SHOW_PREVIEW` | `match-preview` | Teams & match info on screen |
| `SHOW_MATCH` | `match-start` | Match view, timer at 8:00 |
| `START` | `match-start` | Timer begins counting down |
| `AUTO_COMPLETE` | `match-complete` | Match finished, awaiting commit |
| `ABORT` | `blank` | Display cleared |
| `COMMIT` | `match-winner` | Winner announcement |

---

## Concurrency & Safety

- **Single event loop:** State transitions are synchronous within Bun's single thread. No locks needed.
- **Version counter:** Managed by `matchControlSyncHub`, not the state machine. The state machine returns `version: 0` as a placeholder; the real version is assigned on publish.
- **Multi-process:** If deploying multiple workers, state must move to a shared store (Redis, event log) with atomic CAS operations.

---

## Invariants (enforced by `assertStateInvariants`)

| Condition | Rule |
|-----------|------|
| `loadedState === "IDLE"` | `loadedMatch` must be `null` |
| `loadedState !== "IDLE"` | `loadedMatch` must not be `null` |
| `activeState === "IDLE"` | `activeMatch` and `activeStartedAtMs` must be `null` |
| `activeState !== "IDLE"` | `activeMatch` and `activeStartedAtMs` must not be `null` |
| `activeState !== "IDLE"` | `loadedState` must be `IDLE` and `loadedMatch` must be `null` |

The last invariant enforces the rule that only one slot is active at a time.

---

## Common Operator Flows

### Happy path (single match)

```
LOAD → SHOW_PREVIEW → SHOW_MATCH → START → [timer] → AUTO_COMPLETE → COMMIT
```

### Abort and retry

```
LOAD → SHOW_PREVIEW → SHOW_MATCH → START → ABORT
→ (match back in LOADED) → SHOW_PREVIEW → SHOW_MATCH → START → ...
```

### Switch to different match mid-preparation

```
LOAD match A → SHOW_PREVIEW → UNLOAD → LOAD match B → SHOW_PREVIEW → ...
```

### Switch match while one is running

```
LOAD A → ... → START → ABORT → UNLOAD → LOAD B → ...
```

### Replay a committed match

```
COMMIT match A → LOAD match A (from schedule "Replay" button) → ...
```

---

## Anti-Patterns

| ❌ Don't | ✅ Do |
|----------|-------|
| LOAD while `activeState === IN_PROGRESS` | ABORT first, then UNLOAD, then LOAD |
| LOAD while `activeState === COMPLETED` | COMMIT first, then LOAD |
| Skip SHOW_PREVIEW or SHOW_MATCH | Follow the full staging pipeline |
| Ignore `409 STATE_CONFLICT` responses | Re-fetch state and retry with fresh version |
| Assume version after mutation | Use the version returned in the response |
| Call START without checking both slots | Verify `loadedState === READY` **and** `activeState === IDLE` |

---

## API Routes Reference

| Endpoint | Command | Guard |
|----------|---------|-------|
| `POST /:eventCode/match-control/load` | `LOAD` | `activeState === IDLE` |
| `POST /:eventCode/match-control/unload` | `UNLOAD` | `loadedState !== IDLE` |
| `POST /:eventCode/match-control/show-preview` | `SHOW_PREVIEW` | `loadedState === LOADED` |
| `POST /:eventCode/match-control/show-match` | `SHOW_MATCH` | `loadedState === PREVIEW` |
| `POST /:eventCode/match-control/start` | `START` | `loadedState === READY` ∧ `activeState === IDLE` |
| `POST /:eventCode/match-control/abort` | `ABORT` | `activeState === IN_PROGRESS` |
| `POST /:eventCode/match-control/commit` | `COMMIT` | `activeState === COMPLETED` |
| `GET /:eventCode/match-control/state` | — | Read-only snapshot |
| `GET /:eventCode/match-control/stream` | — | SSE subscription |
