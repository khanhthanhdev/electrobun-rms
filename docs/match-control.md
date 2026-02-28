# Match Control Feature - Logic & Workflow Documentation

## Overview

The Match Control page (URL: `/event/$eventcode/control/`) serves as the central command hub for tournament operations. It provides Head Referees, Scorekeepers, and Event Managers with real-time match scheduling, scoring, and administrative controls.

---

## Scoring System Overview

The game uses a **Flag Defense** scoring system with four scoring sections:

| Section | Category | Scoring Mechanics |
|---------|----------|-------------------|
| **A** | Flags Defended | Own alliance flags protected: L2 (25pts), L1 (20pts), Center (10pts) |
| **B** | Flag Offense | Enemy flags destroyed: Center (30pts), Other (10pts) |
| **C** | Bullet Penalty | Bullets in enemy backfield: Deduct 10pts per bullet |
| **D** | Endgame | Robot parking (0/10/15pts) + Golden flag bonus (10pts) |

---

## Core Workflows

### 1. Match Loading & Preparation Workflow

**Goal:** Queue and display next match.

**Steps:**
1. **Load Next Match** 
   - Fetches next match from schedule
   - Updates "Loaded Match" display (name, duration, team numbers)
   - Shows Red and Blue alliance team assignments (e.g., "Red: 5, 2  Blue: 8, 3")
   - Activates **Show Preview** button
   
2. **Show Preview** 
   - Displays match info and teams to audience
   - Allows teams to take field positions
   - Proceeds when ready
   
3. **Show Match**
   - Displays match view to audience (ready state)
   - Activates **Start Match** button

---

### 2. Match Execution Workflow

**Goal:** Run the match and record scores.

**Steps:**
1. **Start Match**
   - Begins official 2:30 countdown timer
   - Activates scoring input panels (red/blue alliances side-by-side)
   - Shows real-time score calculation as data entered
   
2. **Live Scoring Entry**
   
   **Section A — Cờ được bảo vệ (Flags Defended):**
   - L2 Flags: 25 pts each
   - L1 Flags: 20 pts each
   - Center Flags: 10 pts each
   
   **Section B — Bắn phá (Flag Offense):**
   - Center Flags Shot: 30 pts each
   - Other Flags Shot: 10 pts each
   
   **Section C — Đạn trên sân (Bullet Penalty):**
   - Deducts 10 pts per bullet in enemy backfield
   
   **Section D — Giai đoạn kết thúc (Endgame):**
   - Robot Parking: Không (0) / Một phần (10) / Toàn bộ (15)
   - Golden Flags: 10 pts each
   
3. **Score Calculation**
   - **Total = Section A + Section B − Section C + Section D**
   - Auto-updates as operators enter data
   
4. **Match Completion**
   - Timer reaches 0:00
   - Final scores locked and displayed
   - Ready for submission

---

### 3. Score Submission & Posting Workflow

**Goal:** Finalize and commit match results to tournament record.

**Steps:**
1. **Review Scores**
   - Verify final scoring for both alliances
   - Check for fouls/penalties applied correctly
   - Confirm robot parking/positioning states

2. **Commit & Post Last Match** (Available after match completion)
   - Locks scores from further modification
   - Updates match state to COMMITTED
   - Publishes results to public displays and records
   - Enables scheduling of next match

3. **Score Edit** (Available for adjustment)
   - If errors detected, scores can be reopened for correction
   - Allows edit via dedicated "Score Edit" tab
   - Re-submits corrected scores

---

### 4. Quick Match State Reset

**Goal:** Replay or reload a match.

**Steps:**
1. In Schedule table, click **Replay** (for COMMITTED matches)
2. Reloads match to "Loaded Match" position
3. Proceed through Load → Preview → Show → Start sequence again

---

## UI Layout & Components

### Full Page Overview

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [Exit]  🌐 English ▼                                           1234 - Tournament System running at 10.0.0.1  │
│                                                                                                              │
│                                                Match Control                                                 │
│                                                                                                              │
│         Loaded Match:          Playoff Match 3         2:30 (Not Started)          Red: 5, 2     Blue: 8, 3  │
│         Active Match:                                                                                        │
│                                                                                                              │
│               [Load Next Match]  [Show Preview]  [Randomize Field]  [Show Random]  [Show Match]              │
│               [Start Match]                                                      [Commit & Post Last Match]  │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [Schedule] [Incomplete Matches] [Score Edit] [Active Match] [Settings] [Alliance Selection] [Video Switch]...│
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Match            Round Field State       Red Score Red  R1 R2 B1 B2 Blue Blue Score  Actions                 │
│ Playoff Match 1    1     1   COMMITTED      147     A1   5  2  1 14  A4      207     [Replay] [Post] [Edit]  │
│ Playoff Match 2    1     2   COMMITTED      143     A2   8  3  4 12  A3      151     [Replay] [Post] [Edit]  │
│ Playoff Match 3    2     1   UNPLAYED         0     A1   5  2  8  3  A2        0     [Play] [Enter Scores]   │
│ Playoff Match 4    2     2   UNPLAYED         0     A4   1 14  4 12  A3        0     [Play] [Enter Scores]   │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Status Indicators:**
- **Loaded Match:** Current match queued for execution
  - Match name (e.g., "Playoff Match 3")
  - Remaining time (e.g., "2:30")
  - Status badge (Not Started, In Progress, Completed)
  - Team numbers per alliance (e.g., "Red: 5, 2")

- **Active Match:** Currently executing match (shown when timer running)

---

### Global Action Bar

Primary control buttons for match flow, matching the image reference:

| Button | State | Usage | Notes |
|--------|-------|-------|-------|
| **Load Next Match** | Active initially | Queue next match from schedule | Primary action to begin |
| **Show Preview** | Active after load | Display team/match info to audience | Pre-match setup (green highlight when active) |
| **Randomize Field** | Active after load | Trigger randomization if applicable | Field preparation (green highlight when active) |
| **Show Random** | Active after setup | Display randomization to audience | Field preparation |
| **Show Match** | Active when ready | Display match view to audience | Ready for scoring |
| **Start Match** | Active after setup | Begin official 2:30 timer & scoring | Initiates live match |
| **Commit & Post...** | Active on complete | Finalize scores | Right-aligned, final step |

**Workflow Sequence:**
1. **Load Next Match** → Load match from schedule
2. **Show Preview** → Display match info to audience  
3. **Randomize Field** / **Show Random** → Set up field  
4. **Show Match** → Prepare audience display
5. **Start Match** → Begin official timer, activate scoring panels

**Button States:**
- Active buttons: Regular contrast, with "Show Preview" and "Randomize Field" using standout colors (e.g., green `bg-green-600`) when they are the next expected step.
- Disabled buttons: Grayed out, not clickable
- Each enables the next logical step in sequence

---

### Tabbed Navigation

Horizontal tabs for different control views:

| Tab | Purpose | Content |
|-----|---------|---------|
| **Schedule** | View all matches | Full tournament schedule table (active state) |
| **Incomplete Matches** | Monitor unfinished | Filtered list of in-progress matches |
| **Score Edit** | Correct scores | Score adjustment interface |
| **Active Match** | Detailed scoring | Real-time scoring panels and timer |
| **Settings** | Event configuration | Test mode, timing, live scoring options |
| **Alliance Selection** | Team assignments | Alliance picker (disabled when active) |
| **Video Switch** | Broadcast control | Camera/stream selection |
| **Present Awards** | Results display | Award ceremony visuals |
| **Help** | Documentation | Context-sensitive help |

---

## Schedule Data Table (Default View)

### Column Definitions

| Column | Type | Styling Notes |
|--------|------|---------------|
| **Match** | Text | Match ID (Playoff Match 1, etc.) |
| **Round** | Number | Tournament round using `tabular-nums` |
| **Field** | Number | Field assignment, tabular alignment |
| **State** | Badge | COMMITTED, UNPLAYED, IN_PROGRESS |
| **Red Score** | Number | Total red alliance points, tabular font |
| **Red** | Text | Red Alliance ID (e.g., A1), shown during playoffs |
| **R1 / R2** | Number | Team numbers, red alliance tint |
| **B1 / B2** | Number | Team numbers, blue alliance tint |
| **Blue** | Text | Blue Alliance ID (e.g., A2), shown during playoffs |
| **Blue Score** | Number | Total blue alliance points, tabular font |
| **Actions** | Buttons | Context-dependent button set (e.g., Replay, Post, Edit, Play, Enter Scores) |

### Row Action Sets

**Played Matches (COMMITTED):**
- `[Replay]` → Restart match
- `[Post]` → Post to displays (if not posted)
- `[Edit]` → Modify score details

**Unplayed Matches (UNPLAYED):**
- `[Play]` → Start match sequence
- `[Enter Scores]` → Manual score input

**In-Progress Matches (IN_PROGRESS):**
- Timer shows active countdown
- Scoring panels live update
- Actions locked during play

---

## Score Entry Component: ScoringEntryPage

The **ScoringEntryPage** component handles live scoring entry for each alliance during a match.

### Component Props
```typescript
interface ScoringEntryPageProps {
  alliance: "blue" | "red";      // Alliance being scored
  eventCode: string;             // Event identifier
  fieldNumber: string;           // Field number
  matchNumber: number;           // Match number
  onNavigate: (path: string) => void;
}
```

### Data Structure (ScoringState)
```typescript
interface ScoringState {
  flagsL2Defended: number;       // Section A - L2 flags (25 pts each)
  flagsL1Defended: number;       // Section A - L1 flags (20 pts each)
  flagsCenterDefended: number;   // Section A - Center flags (10 pts each)
  flagsCenterShot: number;       // Section B - Center flags shot (30 pts each)
  flagsOtherShot: number;        // Section B - Other flags shot (10 pts each)
  bulletsInEnemyZone: number;    // Section C - Bullets (−10 pts each)
  robotParking: 0 | 1 | 2;       // Section D - Parking (0=None, 1=Partial 10pts, 2=Full 15pts)
  goldenFlagsBonus: number;      // Section D - Golden flags (10 pts each)
}
```

### UI Layout

```
┌─────────────────────────────────────────┐
│ [Red Alliance Scoring]     Match M3 F1  │ (Color-coded header)
├─────────────────────────────────────────┤
│ A — Số cờ được bảo vệ                  │
│  Cờ tầng 2    [−] 1 [+]  25 điểm / 1  │
│  Cờ tầng 1    [−] 2 [+]  20 điểm / 1  │
│  Cờ trung tâm [−] 1 [+]  10 điểm / 1  │
│                                        │
│ B — Bắn phá trên sân đối phương        │
│  Bắn hạ cờ trung tâm [−] 2 [+] 30 pts │
│  Bắn hạ cờ khác      [−] 1 [+] 10 pts │
│                                        │
│ C — Số đạn trên sân đối phương         │
│  Số đạn [−] 0 [+]  Loại bỏ cờ        │
│                                        │
│ D — Giai đoạn kết thúc trận đấu       │
│  Vị trí đỗ: [Không] [Một phần] [Toàn] │
│             Selected: Toàn bộ (15pts)  │
│  Cờ vàng [−] 0 [+]  10 điểm / 1      │
│                                        │
│  ╔════════════════════════════════╗   │
│  ║  Tổng điểm:       147          ║   │
│  ╚════════════════════════════════╝   │
│                                        │
│  [Submit Score] (Full width button)   │
└─────────────────────────────────────────┘
```

### Score Calculation Function

```typescript
const calcTotal = (s: ScoringState): number => {
  const scoreA = 
    s.flagsL2Defended * 25 +
    s.flagsL1Defended * 20 +
    s.flagsCenterDefended * 10;
  
  const scoreB = 
    s.flagsCenterShot * 30 + 
    s.flagsOtherShot * 10;
  
  const scoreC = -(s.bulletsInEnemyZone * 10);  // Penalty
  
  const scoreD = 
    (s.robotParking === 2 ? 15 : s.robotParking === 1 ? 10 : 0) +
    s.goldenFlagsBonus * 10;
  
  return Math.max(0, scoreA + scoreB + scoreC + scoreD);
};
```

### Key Components

**CounterRow:**
- Label + point hint text
- Decrement button (−)
- Display value (bold, right-aligned)
- Increment button (+)
- Prevents negative values

**SectionHeader:**
- Colored accent stripe (alliance color)
- Uppercase section label

**Parking State Toggle:**
- Three exclusive buttons: Không / Một phần / Toàn bộ
- Active state highlighted with alliance color
- Only one state selectable at a time

---

## Scoresheet Display Component: MatchScoresheetPage

The **MatchScoresheetPage** component displays match scores in read-only format for review and analysis.

### Component Props
```typescript
interface MatchScoresheetPageProps {
  eventCode: string;
  matchName: string;             // Format: Q1, P5, E2 (Q=quals, P=practice, E=elims)
  allianceFilter?: "red" | "blue"; // Optional: show only one alliance
  onNavigate: (path: string) => void;
  token: string | null;
}
```

### Features

- **Match Name Parsing:** Extracts match type and number from name string (regex: `^([QEP])(\d+)$`)
- **Alliance Toggle:** Mobile-friendly selector (Blue / Red / All)
- **Read-only Display:** Shows all four scoring sections per alliance
- **Flexible Layout:** Single column (mobile) or two-column (desktop)
- **Back Navigation:** Returns to match results page

### Data Structure (MatchHistoryItem)
```typescript
interface MatchHistoryItem {
  ts: number;
  alliance: "red" | "blue";
  aSecondTierFlags: number;      // Section A - L2 flags
  aFirstTierFlags: number;       // Section A - L1 flags
  aCenterFlags: number;          // Section A - Center flags
  bCenterFlagDown: number;       // Section B - Center shot
  bBaseFlagsDown: number;        // Section B - Other shot
  cOpponentBackfieldBullets: number;  // Section C - Bullets
  dRobotParkState: number;       // Section D - Parking state
  dGoldFlagsDefended: number;    // Section D - Golden flags
  scoreA: number;
  scoreB: number;
  scoreC: number;
  scoreD: number;
  scoreTotal: number;            // Total calculated score
}
```

### UI Layout

```
┌─────────────────────────────────────┐
│ ← Back to Match Results             │
│ Scoresheet for Q1                   │
├─────────────────────────────────────┤
│ [Blue] [Red] [All] (Mobile toggle)  │
├─────────────────────────────────────┤
│ RED ALLIANCE          BLUE ALLIANCE  │
├─────────────────────────────────────┤
│ A — Số cờ được bảo vệ              │
│  Cờ tầng 2      25 pts/1        2  │
│  Cờ tầng 1      20 pts/1        1  │
│  Cờ trung tâm   10 pts/1        1  │
│                                    │
│ B — Bắn phá                         │
│  Bắn hạ cờ TT   30 pts/1        2  │
│  Bắn hạ cờ khác 10 pts/1        1  │
│                                    │
│ C — Đạn trên sân                    │
│  Số đạn         loại bỏ cờ      0  │
│                                    │
│ D — Giai đoạn kết thúc             │
│  Vị trí đỗ      [Toàn bộ]       15 │
│  Cờ vàng        10 pts/1        1  │
│                                    │
│  ╔══════════════════════════════╗ │
│  ║ Tổng điểm:        147         ║ │
│  ╚══════════════════════════════╝ │
└─────────────────────────────────────┘
```

### Usage Example

```typescript
// Display scoresheet for Red alliance only
<MatchScoresheetPage
  eventCode="event123"
  matchName="Q1"
  allianceFilter="red"
  token={authToken}
  onNavigate={navigate}
/>

// Display both alliances with toggle
<MatchScoresheetPage
  eventCode="event123"
  matchName="P5"
  token={authToken}
  onNavigate={navigate}
/>
```

---

## Settings & Configuration

### Active Match Schedule Controls

- **Enter Test Mode** → Load dummy match for testing
- **Advance to Quals** → Move to qualification matches
- **Return to Practice** → Return to practice matches

### Live Scoring Options

| Setting | Default | Effect |
|---------|---------|--------|
| **Use Live Scoring** | ON | Enable real-time score input |
| **Require Referee Init Submit Before Start** | OFF | Referee must confirm readiness |
| **Enable Penalty Referee Tablets** | OFF | Remote penalty entry devices |
| **Enable HR Match Control (Beta)** | OFF | Head referee tablet integration |
| **Allow External Randomization** | OFF | External field randomizer device |

### Control Page Appearance

| Setting | Options | Effect |
|---------|---------|--------|
| **Flip Alliances** | OFF | Red on right; ON = Red on left |
| **Score Tab Contrast** | Standard / High | Display contrast adjustment |

### Sync Settings

| Setting | Options | Effect |
|---------|---------|--------|
| **Sync Delay** | 5s, 10s, 15s, 30s | Network sync polling interval |

---

## State Management

### Match States

```
UNPLAYED
  ├─ Load Next Match
  └─ ▼ PENDING

PENDING
  ├─ Show Preview
  ├─ Randomize Field
  └─ ▼ READY

READY
  ├─ Show Match
  └─ Start Match
     └─ ▼ IN_PROGRESS

IN_PROGRESS
  ├─ Live Scoring Input
  ├─ Timer Running
  └─ [Timer Expires]
     └─ ▼ COMPLETED

COMPLETED
  ├─ Review Scores
  ├─ Optional: Edit
  └─ Commit & Post
     └─ ▼ COMMITTED

COMMITTED
  ├─ Published to public displays
  ├─ Locked from modification
  ├─ [Replay] available
  └─ Schedule continues
```

### Button Availability by State

| State | Available Buttons |
|-------|-------------------|
| **UNPLAYED** | Load Next Match |
| **PENDING** | Show Preview, Randomize Field |
| **READY** | Show Match, Start Match |
| **IN_PROGRESS** | (Timer active, scoring input only) |
| **COMPLETED** | Commit & Post Last Match, Edit |
| **COMMITTED** | Load Next Match, Replay, Post, Edit |

---

## Data Persistence & Sync

### Synchronization Strategy

- **Sync Delay:** Configurable polling interval (5-30s)
- **Network State:** Displayed in footer ("6m behind" = scheduling lag)
- **Field Status:** Real-time updates from field tablets
- **Score State:** Atomic commits with validation

### Error Handling

- **Connection Loss:** UI shows "network error" with retry
- **Score Conflict:** Shows mismatch alert; operator chooses version
- **Timer Desync:** Resynchronizes with server on next interval
- **Incomplete Submit:** Prevents progression until scores complete

---

## Accessibility & Usability

### Color & Contrast
- Use `--alliance-red` and `--alliance-blue` CSS variables for alliance indication
- Ensure hover states (e.g., `hover:bg-muted/50`) on interactive rows
- High contrast button labels for visibility
- Semantic status badges (✓, ●, ○) + color + text

### Typography
- **Tabular Numbers:** All scores, team numbers, round/field use `font-variant-numeric: tabular-nums`
- **Page Title:** `h1` or `.page-title` class, centered
- **Labels:** Muted foreground color for descriptive text
- **Values:** Bold/bright foreground for data

### Mobile Responsiveness
- Schedule table: Horizontal scroll on small screens
- Action buttons: Stack vertically if needed
- Tabs: Horizontal scroll with show/hide for less critical tabs

### Keyboard & Screen Reader Support
- All buttons and links keyboard-accessible
- Tab order follows visual flow
- ARIA labels on status indicators
- Form inputs properly labeled

---

## Component Integration

### Core Scoring Workflow

1. **ScoringEntryPage** → Operator enters alliance scores
2. **MatchScoresheetPage** → Review scores before submission
3. **Schedule Table** → Final scores appear in tournament listing

### Component Dependencies

**ScoringEntryPage** requires:
- `alliance`: "red" | "blue" (determined by which operator/tablet)
- `eventCode`, `fieldNumber`, `matchNumber`: Match context
- `onNavigate`: Back button handler

**MatchScoresheetPage** requires:
- `matchName`: Parsed to determine match type/number
- `eventCode`: Event context
- `token`: Authentication for API calls
- Optional `allianceFilter`: Restrict to one alliance

### State Management

**Local State (within components):**
```typescript
// ScoringEntryPage
const [score, setScore] = useState<ScoringState>(INITIAL_STATE);
const total = calcTotal(score);

// MatchScoresheetPage  
const { scoresheet, isLoading, error } = useMatchScoresheet(
  eventCode,
  matchType,
  matchNumber,
  token,
  enabled
);
```

**State Updates:**
- Counters increment/decrement: `setScore(s => ({ ...s, field: value }))`
- Parking toggle: `setScore(s => ({ ...s, robotParking: newValue }))`
- Total recalculates automatically via `calcTotal(score)`

### Sub-Components (ScoringEntryPage internals)

**CounterRow:**
- Props: `label`, `value`, `pts`, `onIncrement`, `onDecrement`
- Renders: − button | value display | + button | points hint
- Style: Flex layout, border-bottom separator

**SectionHeader:**
- Props: `label`, `accent` (alliance color)
- Renders: Colored accent stripe | uppercase label
- Style: Border-bottom underline

**PARKING_OPTIONS:**
```typescript
const PARKING_OPTIONS: { label: string; value: ParkingState }[] = [
  { value: 0, label: "Không" },
  { value: 1, label: "Một phần" },
  { value: 2, label: "Toàn bộ" },
];
```

### Key Hooks

**useMatchScoresheet()** (MatchScoresheetPage):
```typescript
const { scoresheet, isLoading, error } = useMatchScoresheet(
  eventCode,
  matchType,
  matchNumber,
  token,
  shouldFetch  // Boolean to enable/disable fetch
);
```
- Fetches scoresheet data from API
- Returns `MatchScoresheet` with red/blue scores
- Handles loading and error states

**Color Constants:**
```typescript
const ALLIANCE_COLOR: Record<"red" | "blue", string> = {
  red: "#dc2626",    // Tailwind red-600
  blue: "#0284c7",   // Tailwind sky-600
};
```

---

## Event Flows

### Typical Match Control Session

1. **Startup**
   - Load event schedule
   - Display "Load Next Match" as primary action
   - Show Schedule tab with all matches

2. **Match Preparation**
   - Click "Load Next Match"
   - System queues next match, displays team assignments
   - "Show Preview" becomes active (green)

3. **Randomization & Setup**
   - Click "Randomize Field"
   - Field elements randomized per game rules
   - "Show Match" and "Start Match" become active

4. **Match Execution**
   - Click "Start Match"
   - Timer begins (2:30 countdown)
   - Scoring panels live-update as fouls/scores entered
   - Tab automatically switches to "Active Match"

5. **Score Finalization**
   - Timer expires; match state = COMPLETED
   - "Commit & Post Last Match" becomes active
   - Operator reviews scores for accuracy

6. **Publication**
   - Click "Commit & Post"
   - Scores locked and published
   - Match state = COMMITTED
   - Displays updated in real-time
   - Schedule advances

7. **Next Match**
   - Repeat cycle from step 2

---

## Error Scenarios & Recovery

| Scenario | Detection | Recovery |
|----------|-----------|----------|
| Network disconnect | Sync timer expires | Retry on reconnect; cache local scores |
| Score input incomplete | Validation on submit | Highlight missing fields; prevent commit |
| Timer desynchronization | Server vs. local mismatch | Force resync; display warning |
| Duplicate submit | Idempotency check | Server rejects; show confirmation modal |
| Match already in progress | State check | Disable "Load Next" if match running |
| No randomization | Field status check | "Start Match" disabled until randomized |

---

## Future Enhancements

- **Multi-field support:** Manage multiple matches in parallel
- **Remote scoring:** Mobile tablet interface for on-field referees
- **Match replay:** Video replay integration with scoring overlays
- **Analytics:** Real-time match statistics and trend analysis
- **Mobile app:** Native iOS/Android for operator control
- **Accessibility:** Full screen reader support, voice commands

---

## Related Documentation

- `./.claude/rules/development-rules.md` - Coding standards
- `./docs/design-guidelines.md` - UI/UX patterns
- `./docs/code-standards.md` - TypeScript conventions
- `./README.md` - Project overview
