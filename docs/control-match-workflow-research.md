# Control Match Workflow Research

**Source:** FTC Live at `http://172.16.12.215/event/1234/control/`  
**Date:** 2025-02-28  
**Focus:** Load match, Show preview, Show match, Start/Abort match, Dual load next match (no randomize / show random)

---

## Login Flow

- **URL:** `/login/` or `/login/default/`
- **Default user:** Username `local`, no password
- **Event-specific:** `/login/default/` offers Event dropdown (e.g. 111 - TEST, 1234 - NRC 2026, 2705 - S4V test) and Username combobox (e.g. `1234_eventadmin`, `1234_fta`)
- **Note:** FTC Live shows "does not support Electron" warning in Electron-based browsers

---

## Core Workflow (Simplified — No Randomize)

For events that **do not use** Randomize Field / Show Random:

```
Load Next Match → Show Preview → Show Match → Start Match → [Timer] → Commit & Post
```

| Step | Action | Effect | Next enabled |
|------|--------|--------|--------------|
| 1 | **Load Next Match** | Queues next match; shows name, duration, Red/Blue teams | Show Preview |
| 2 | **Show Preview** | Shows match info to audience; teams take field | Show Match |
| 3 | **Show Match** | Shows match view; ready for scoring | Start Match |
| 4 | **Start Match** | Starts 2:30 timer; enables live scoring | — |
| 5 | Timer ends | Match COMPLETED | Commit & Post Last Match |

---

## State Machine

```
UNPLAYED
  │
  └─ Load Next Match ─► PENDING
                         │
                         ├─ Show Preview ──► (stays PENDING)
                         │
                         └─ Show Match ───► READY
                                             │
                                             └─ Start Match ─► IN_PROGRESS
                                                                 │
                                                                 └─ [Timer expires] ─► COMPLETED
                                                                                        │
                                                                                        └─ Commit & Post ─► COMMITTED
```

### State Transitions

| From | Action | To |
|------|--------|-----|
| UNPLAYED | Load Next Match | PENDING |
| PENDING | Show Preview | PENDING (audience display updated) |
| PENDING | Show Match | READY |
| READY | Start Match | IN_PROGRESS |
| IN_PROGRESS | Timer expires | COMPLETED |
| COMPLETED | Commit & Post Last Match | COMMITTED |
| COMMITTED | Load Next Match | PENDING (new match) |
| COMMITTED | Replay | PENDING (same match reloaded) |

---

## Start / Abort Match

- **Start Match:** Starts official 2:30 countdown; locks control buttons; enables scoring panels
- **Abort:** Not clearly exposed in the UI; likely:
  - Scenario 1: Operator can stop/reset from Settings or a hidden control
  - Scenario 2: Match can be reverted via Schedule → Replay (after committing a dummy or reopening)
  - Recommendation: Verify in live UI whether "Abort", "Stop Match", or "Reset" exists

---

## Dual Load Next Match

**Concept:** Load the next match while the current one is running or displayed.

- **When:** After current match is COMMITTED, or during COMPLETED before Commit & Post (depending on implementation)
- **Effect:** Next match is fetched and shown in "Loaded Match" so operators can prepare without delay
- **Sequence:**
  1. Current match COMPLETED → Commit & Post
  2. Load Next Match → new match in PENDING
  3. Show Preview → Show Match → Start Match (next cycle)

---

## Button State Matrix (Simplified — No Randomize)

| State | Load Next Match | Show Preview | Show Match | Start Match | Commit & Post |
|-------|-----------------|--------------|------------|-------------|---------------|
| UNPLAYED | ✓ | ✗ | ✗ | ✗ | ✗ |
| PENDING | ✓* | ✓ | ✓ | ✗ | ✗ |
| READY | ✓* | ✓ | ✓ | ✓ | ✗ |
| IN_PROGRESS | ✗ | ✗ | ✗ | ✗ | ✗ |
| COMPLETED | ✓ | ✗ | ✗ | ✗ | ✓ |
| COMMITTED | ✓ | ✗ | ✗ | ✗ | ✗ |

\* May be disabled while match in progress; behavior is implementation-dependent.

---

## UI / UX Design Notes

### Visual hierarchy

- **Loaded Match:** Prominent; shows match name, duration, Red/Blue teams
- **Active Match:** Shown when timer is running
- **Action bar:** Primary controls in a horizontal row; "Commit & Post" right-aligned

### Button affordances

- **Active:** Full contrast; green highlight for next logical step (e.g. Show Preview)
- **Disabled:** Grayed out, not clickable
- **Sequence:** Each step enables the next

### Tabbed layout

- **Schedule** (default): Match list with state badges and row actions
- **Active Match:** Live scoring and timer
- **Score Edit:** Post-match corrections

---

## App vs Reference (FTC Live)

| Aspect | FTC Live (reference) | This app |
|--------|----------------------|----------|
| URL | `/event/{id}/control/` | Same pattern |
| Match states | UNPLAYED → PENDING → READY → IN_PROGRESS → COMPLETED → COMMITTED | See `ControlMatchState` |
| Randomize | Optional | Not used (per user) |
| Dual load | Supported | Implement per backend API |

---

## Open Questions

1. **Abort match:** Exact flow and UI for aborting a match in progress
2. **Dual load timing:** When can "Load Next Match" be invoked relative to Commit & Post
3. **Field count:** How multi-field events affect loaded vs active match display
