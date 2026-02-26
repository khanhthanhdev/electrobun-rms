# Scoring Routes, Logic & Workflow

> Based on research of FTC Live Scoring System v7.3.0 at `172.16.16.222`

---

## 1. Route Architecture

### 1.1 Route Pattern

All scoring routes follow this hierarchical pattern:

```
/event/{eventCode}/{role}/{color?}/scoring/
                    │
                    ├── ref/red/scoring/     → Red Scoring Referee entry
                    ├── ref/blue/scoring/    → Blue Scoring Referee entry
                    └── hr/                  → Head Referee entry
```

After field selection, routes resolve to:

```
/event/{eventCode}/{role}/field/{fieldId}/{color?}/scoring/#{match-fragment}
```

### 1.2 Complete Route Map

| Route | Role | Description |
|-------|------|-------------|
| `/event/1234/` | Public | Event dashboard with all navigation links |
| `/event/1234/ref/red/scoring/` | Red Referee | Entry → field selection for red alliance scoring |
| `/event/1234/ref/blue/scoring/` | Blue Referee | Entry → field selection for blue alliance scoring |
| `/event/1234/hr/` | Head Referee | Entry → field selection for HR dashboard |
| `/event/1234/ref/field/all/red/scoring/` | Red Referee | All-fields red scoring, match selection |
| `/event/1234/ref/field/all/blue/scoring/` | Blue Referee | All-fields blue scoring, match selection |
| `/event/1234/ref/field/{1-4}/red/scoring/` | Red Referee | Specific field red scoring, match selection |
| `/event/1234/ref/field/{1-4}/blue/scoring/` | Blue Referee | Specific field blue scoring, match selection |
| `/event/1234/ref/field/all/red/scoring/#match-{N}` | Red Referee | Scoreboard for match N (all fields) |
| `/event/1234/ref/field/{1-4}/red/scoring/#match-{N}` | Red Referee | Scoreboard for match N (specific field) |
| `/event/1234/ref/field/all/blue/scoring/#match-{N}` | Blue Referee | Scoreboard for match N (all fields) |
| `/event/1234/ref/field/{1-4}/blue/scoring/#match-{N}` | Blue Referee | Scoreboard for match N (specific field) |
| `/event/1234/hr/field/all/` | Head Referee | HR dashboard for all fields |
| `/event/1234/hr/field/{1-4}/` | Head Referee | HR dashboard for specific field |

### 1.3 Route Parameters

| Parameter | Values | Description |
|-----------|--------|-------------|
| `eventCode` | e.g. `1234` | Unique event identifier |
| `role` | `ref`, `hr` | `ref` = Alliance Scoring Referee, `hr` = Head Referee |
| `fieldId` | `all`, `1`, `2`, `3`, `4` | Field number or all fields |
| `color` | `red`, `blue` | Alliance color (only for `ref` role) |
| `#match-{N}` | e.g. `#match-3` | Hash fragment selecting active match (client-side) |

### 1.4 JavaScript Window Config

Each scoring page injects config into `window`:

```javascript
Object.assign(window, {
  field: 0,              // 0 = all fields, 1-4 = specific field
  matchTiming: {
    auto: "PT30S",       // Autonomous period: 30 seconds
    transition: "PT8S",  // Transition period: 8 seconds
    teleop: "PT2M",      // TeleOp period: 2 minutes
    endgameWarning: "PT20S", // Endgame warning: 20 seconds before end
    total: "PT2M38S"     // Total match time: 2 min 38 sec
  },
  position: "SCORING_RED" | "SCORING_BLUE",  // Alliance assignment
  penaltyTabletEnabled: false,
  eventCode: "1234",
  fieldCount: 4          // Number of fields at this event
});
```

---

## 2. Workflow — Scoring Referee (Red/Blue)

### 2.1 Navigation Flow

```
Login (username: local)
  └─► /event/{code}/ref/{color}/scoring/
        │
        ├─► Select "Field 1" → /event/{code}/ref/field/1/{color}/scoring/
        ├─► Select "Field 2" → /event/{code}/ref/field/2/{color}/scoring/
        ├─► Select "Field 3" → /event/{code}/ref/field/3/{color}/scoring/
        ├─► Select "Field 4" → /event/{code}/ref/field/4/{color}/scoring/
        └─► Select "All Matches" → /event/{code}/ref/field/all/{color}/scoring/
              │
              └─► Click active match card (e.g. "Match M3")
                    └─► #match-3 → Scoring Scoreboard opens
```

### 2.2 Scoring Phases (Sequential)

The scoring referee proceeds through these phases in order:

```
┌─────────────────┐
│  1. PRE-MATCH   │  Cross-alliance team presence check
│     SETUP       │  (Red ref checks Blue teams, Blue ref checks Red teams)
├─────────────────┤
│  2. AUTONOMOUS  │  Score auto-period actions (30 sec)
│     (AUTO)      │
├─────────────────┤
│  3. TRANSITION  │  8-second buffer between phases
│                 │
├─────────────────┤
│  4. TELEOP      │  Score teleop-period actions (2 min)
│                 │  Includes endgame scoring
├─────────────────┤
│  5. SUBMIT      │  Final score submission
│                 │  (may trigger HR Review if flagged)
└─────────────────┘
```

### 2.3 Pre-Match Setup

- **Red Scoring Referee** checks **Blue Alliance** team presence
- **Blue Scoring Referee** checks **Red Alliance** team presence
- For each team: toggle "Not Playing" / "On Field"
- Click "{Color} Alliance Ready" to proceed

### 2.4 Match Selection UI

The match selection page shows:
- Header: `Match Selection ({Field Label})`
- Match cards displaying: Match ID (e.g. "Match M3"), Red Teams, Blue Teams
- Only the current active match is shown as selectable

---

## 3. Workflow — Head Referee (HR)

### 3.1 Navigation Flow

```
Login
  └─► /event/{code}/hr/
        │
        ├─► "All Matches" → /event/{code}/hr/field/all/
        └─► "Field {N}"   → /event/{code}/hr/field/{N}/
```

### 3.2 HR Dashboard Tabs

The Head Referee interface has **4 tabs**:

| Tab | Purpose |
|-----|---------|
| **Active Match** | Live scoring overview, foul entry, review controls |
| **Notes** | Match & meeting notes (by match or by team) |
| **Timers** | G301 & T206 timing management |
| **Scoresheets** | View/manage paper scoresheet data |

### 3.3 Active Match Tab

Displays side-by-side alliance view:
- **Match info**: Match ID, Field, Status (Unplayed/Running/Complete), Randomization
- **Referee Status**: Shows each alliance referee's connection state (INIT, SCORING, SUBMITTED)
- **Scoring Phase**: Current phase indicator
- **Foul Tracking**:
  - Minor Fouls: total, per-referee input (R/B), HR overrides with +/- controls
  - Major Fouls: total, per-referee input (R/B), HR overrides with +/- controls
- **Score Breakdown**:
  - AUTO Scores: Classified, Overflow, Pattern, Robot Location
  - TELEOP Scores: Classified, Overflow, Depot, Pattern, Robot Location
- **Cards**: Assign cards per team (cycle: None → Yellow → Red → Yellow+Red)
- **Controls**:
  - "Flip Alliances" — swap Red/Blue orientation
  - "Review Required?" — flag match for post-match review (locks scores until HR completes)
  - "Add Note" — quick note entry

### 3.4 Review Workflow

```
HR taps "Review Required?"
  └─► Match flagged for review
        └─► At match end, scores are HELD
              └─► Both scoring referees must submit
                    └─► HR "Complete" button appears
                          └─► HR completes review
                                └─► Scores released to scorekeeper
```

- If cards are entered, Review Required is **auto-locked ON**
- Referees should enter review (submit TELEOP) before making adjustments
- Only the scorekeeper can edit scores after referee submit

### 3.5 Notes Tab

- **By Match**: Notes grouped by match, each with summary + detail items
- **By Team**: Notes grouped by tagged team
- **Meeting Notes**: Separate tabs for Referee, Drivers, Captains, Other meetings

### 3.6 Timers Tab (G301 & T206)

| Rule | Description | Minimum Time |
|------|-------------|--------------|
| **G301** | Field turnaround time | 3 min from last match end on same field |
| **T206** | Back-to-back team rest | 5 min from score post of previous match |
| **T206/G301** | Alliance rest | 8 min from score post of alliance's last match |

Timer table columns: Match, Type, Start, Length, End, Time Left

---

## 4. Role Permissions Summary

| Feature | Red Ref | Blue Ref | Head Referee | Scorekeeper |
|---------|---------|----------|--------------|-------------|
| Score own alliance | ✅ | ✅ | ❌ | ❌ |
| Check opposing teams present | ✅ | ✅ | ❌ | ❌ |
| View live scores (both alliances) | ❌ | ❌ | ✅ | ✅ |
| Enter fouls (own input) | ✅ | ✅ | ✅ (HR fouls) | ❌ |
| Assign cards | ❌ | ❌ | ✅ | ❌ |
| Flag review | ❌ | ❌ | ✅ | ❌ |
| Edit scores post-submit | ❌ | ❌ | ❌ | ✅ |
| Complete review | ❌ | ❌ | ✅ | ❌ |
| Commit match | ❌ | ❌ | ❌ | ✅ |

---

## 5. Match Timing

| Phase | Duration |
|-------|----------|
| Autonomous | 30 seconds |
| Transition | 8 seconds |
| TeleOp | 2 minutes |
| Endgame Warning | 20 seconds before TeleOp ends |
| **Total Match** | **2 minutes 38 seconds** |

---

## 6. Multi-Field Support

The system supports up to **4 concurrent fields**. Key behaviors:
- `field: 0` (route `field/all`) — shows matches across all fields
- `field: 1-4` (route `field/{N}`) — scoped to a single field
- HR Active Match tab shows field assignment per match
- G301 timers track per-field turnaround
- Match cards in field selection show field assignment

---

## 7. Authentication

- All scoring/HR routes require authentication (redirects to `/login/` if unauthenticated)
- Default user: `local` (no password)
- Session is cookie-based; auth state persists across page navigation
