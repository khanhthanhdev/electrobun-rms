# Display Control Workflow — Combined Guide

This document describes the end-to-end workflow for controlling the audience display from the admin control page. It lists all screens, required settings, and each action with its effect. **This application does not use randomization** (no Randomize Field / Show Random).

---

## Prerequisites

### Server and URLs

| Item | Value |
|------|-------|
| **Server** | FTCLive (or compatible scoring server) running, e.g. `http://localhost:8080` |
| **Login** | `http://localhost:8080/login/` |
| **Control page** | `http://localhost:8080/event/{eventCode}/control/` |
| **Display page** | `http://localhost:8080/event/{eventCode}/display/` |

**Example event (s4v1):**
- Login: `http://localhost:8080/login/` (username `local`, no password)
- Control: `http://localhost:8080/event/s4v1/control/`
- Display: `http://localhost:8080/event/s4v1/display/`

### Required settings before running

1. **Display page**
   - Open `http://localhost:8080/event/{eventCode}/display/`
   - Close or Save the "Display Options" modal so the full-screen audience view is visible
   - Optional: set **Display Type** (Audience, Field, Pit, Sponsor, Championship Bar), **Bind to Field**, timer style, etc.

2. **Control page**
   - Log in (e.g. username `local`, no password for default user)
   - Ensure an active schedule is set (Practice, Qualification, etc.)
   - At least one match available in the schedule

---

## Display screens — complete list

All screens are rendered on the same URL: `/event/{eventCode}/display/`. Content changes when the admin triggers commands from the control page.

| # | Screen | Screenshot | Triggered by | Description |
|---|--------|------------|--------------|-------------|
| 1 | **Next Match** | `docs/display/next_match.png` | Show Preview (or default idle) | "Up Next" style: upcoming match name, team numbers, event title. No timer. |
| 2 | **Match Preview** | `docs/display/match_preview.png` | Show Match (before Start) | Match view with timer at 2:30 (not counting), Red/Blue teams, 0–0 scores, RP progress bars. |
| 3 | **Match Start** | `docs/display/match_start.png` | Start Match | Timer running; phase changes (AUTO → transition → TELEOP); scoring visible. |
| 4 | **Match Winner** | `docs/display/match_winner.png` | Timer ends + Commit & Post | Final scores, winner highlight, match result. |
| 5 | **Blank Screen** | `docs/display/blank_screen.png` | Show Blank Screen | Minimal or empty view; may show audio warning overlay. |
| 6 | **Ranking and Result** | `docs/display/ranking_and_result.png` | Show Ranks & Results | Rankings table: Rank, Team, stats columns. |
| 7 | **Robot Inspection Status** | `docs/display/robot_inspection_status.png` | Show Inspection Status | Inspection list: team rows and inspection progress. |
| 8 | **Text Notification** | `docs/display/text_notification.png` | Show Message | Custom text message or notification. |
| 9 | **Video Only (Overlay)** | — | Show Video Only (Overlay) | Video/camera feed with overlay; no scoring UI. |
| 10 | **Sponsors** | — | Show Sponsors | Sponsor logos/content. |
| 11 | **Slideshow** | — | Show Slideshow | General slideshow content. |
| 12 | **Wifi Reminder** | — | Show Wifi Reminder | Wifi/network reminder. |
| 13 | **Audience Key** | — | Show Audience Key | Audience key / team lookup info. |
| 14 | **Safety & Security** | — | Show Safety & Security | Safety and security info. |
| 15 | **Bracket** | — | Show Bracket | Elimination bracket. |
| 16 | **Alliance Selection** | — | Show Alliance Selection | Alliance selection view. |
| 17 | **Online Results Info** | — | Show Online Results Info | Online results information. |

---

## Control page tabs and sections

| Tab | Purpose |
|-----|---------|
| **Schedule** | Match list, Load Next Match, row actions (Play, Enter Scores, Replay, etc.) |
| **Incomplete Matches** | Filtered list of unfinished matches |
| **Score Edit** | Post-match score correction |
| **Active Match** | Live scoring panels, fouls, timer state |
| **Settings** | Test mode, live scoring options, sync, display-related toggles |
| **Video Switch** | Display mode buttons (Sponsors, Blank, Message, etc.) |
| **Present Awards** | Award ceremony visuals |
| **Help** | Documentation |

Display mode commands (Show Blank Screen, Show Ranks & Results, etc.) are under **Settings** or **Video Switch**, inside sections such as **General Information**, **Eliminations**, **Other Displays**, **Message**. Expand "Set Audience Display" if the buttons are in collapsible panels.

---

## Match flow — actions and effects

### 1. Load Next Match

| Property | Value |
|----------|-------|
| **Where** | Control page, action bar |
| **Action** | Click **Load Next Match** |
| **When enabled** | UNPLAYED or COMMITTED state |
| **Effect** | Loads next match from schedule; shows name, duration, Red/Blue team numbers in "Loaded Match" area |
| **Display change** | None (display keeps current mode) |
| **Next enabled** | Show Preview |

### 2. Show Preview

| Property | Value |
|----------|-------|
| **Where** | Control page, action bar |
| **Action** | Click **Show Preview** |
| **When enabled** | After Load Next Match (PENDING) |
| **Effect** | Sends "preview" command to audience displays |
| **Display change** | Display shows **Next Match** screen (`next_match.png`): "Up Next", match name, team numbers |
| **Next enabled** | Show Match |

### 3. Show Match

| Property | Value |
|----------|-------|
| **Where** | Control page, action bar |
| **Action** | Click **Show Match** |
| **When enabled** | After Show Preview |
| **Effect** | Switches display to match view; timer at 2:30, not counting |
| **Display change** | Display shows **Match Preview** screen (`match_preview.png`): field, teams, 0–0, RP bars |
| **Next enabled** | Start Match |

### 4. Start Match

| Property | Value |
|----------|-------|
| **Where** | Control page, action bar |
| **Action** | Click **Start Match** |
| **When enabled** | After Show Match (READY) |
| **Effect** | Starts official match timer; enables live scoring |
| **Display change** | Display shows **Match Start** screen (`match_start.png`): timer counting down, phase changes (AUTO → transition → TELEOP) |
| **Next enabled** | Abort (during match); Commit & Post (after timer ends) |

### 5. Commit & Post Last Match

| Property | Value |
|----------|-------|
| **Where** | Control page, action bar |
| **Action** | Click **Commit & Post Last Match** |
| **When enabled** | After timer ends (COMPLETED) |
| **Effect** | Finalizes scores, publishes to displays and records |
| **Display change** | Display shows **Match Winner** screen (`match_winner.png`) with final scores and winner |
| **Next enabled** | Load Next Match |

---

## Display mode switches — actions and effects

These commands override the match flow and switch the display to a specific mode. They are in **Settings** or **Video Switch** under "Set Audience Display" (or similar).

### Other Displays

| Action | Display change |
|--------|----------------|
| **Show Ranks & Results** | Rankings table: Rank, Team, RS, POINTS, BASE, Plays (`ranking_and_result.png`) |
| **Show Blank Screen** | Blank or minimal view (`blank_screen.png`); may show audio warning |
| **Show Video Only (Overlay)** | Video/camera overlay; no scoring UI |
| **Show Online Results Info** | Online results info screen |
| **Show Inspection Status** | Robot inspection list (`robot_inspection_status.png`) |

### General Information

| Action | Display change |
|--------|----------------|
| **Show Slideshow** | Slideshow content |
| **Show Sponsors** | Sponsor logos/content |
| **Show Wifi Reminder** | Wifi reminder |
| **Show Audience Key** | Audience key / team lookup |
| **Show Safety & Security** | Safety and security info |

### Eliminations

| Action | Display change |
|--------|----------------|
| **Show Bracket** | Elimination bracket |
| **Show Alliance Selection** | Alliance selection view |

### Message

| Action | Display change |
|--------|----------------|
| **Show Message** | Custom text message (`text_notification.png`) |

---

## Typical workflow sequences

### A. Run one match

1. Log in at `/login/` (e.g. `local`, no password).
2. Open control: `/event/s4v1/control/`.
3. Open display (separate window/screen): `/event/s4v1/display/`; close Display Options modal.
4. **Load Next Match** → confirm in Load dialog.
5. **Show Preview** → display shows "Up Next".
6. **Show Match** → display shows match preview (2:30, 0–0).
7. **Start Match** → timer runs; display shows live match.
8. When timer ends → **Commit & Post Last Match** → display shows match winner.
9. Repeat from step 4 for next match.

### B. Switch display to non-match content

1. Open control, go to **Settings** or **Video Switch**.
2. Expand **Set Audience Display** (or equivalent).
3. Click desired mode, e.g. **Show Ranks & Results**, **Show Blank Screen**, **Show Inspection Status**.
4. Display updates immediately to that mode.
5. To return to match flow, use **Show Preview** or **Show Match** as appropriate.

---

## Display settings (on display page)

Configured on `/display` via the Display Options modal (gear icon).

| Setting | Options | Effect |
|---------|---------|--------|
| **Display Name** | Text | Optional label for this display |
| **Display Type** | Audience, Field, Pit, Sponsor, Championship Bar | Changes layout/role |
| **Bind to Field** | (All), Field 1, Field 2, … | Filters content by field in multi-field events |
| **Timer style** | Field-style (big timer), Overlay | Timer placement and style |
| **Scoring Bar Location** | Bottom, Top | Location of scoring bar |
| **Alliance Orientation** | Standard (Red on Left), Flipped (Red on Right) | Alliance layout |
| **Rankings Font Size** | Larger, Smaller | Rankings text size |
| **Mute** / **Mute Results** | On/Off | Audio behavior |

---

## Control settings (on control page)

Configured under **Settings** tab.

| Setting | Effect |
|---------|--------|
| **Use Live Scoring** | Enables real-time score input |
| **Require Referee Init Submit Before Match Start** | Referee must confirm before Start Match |
| **Flip Alliances (Red on Left)** | Alliance layout on control page |
| **Score tab contrast** | Standard, High, Max, Dark Mode |
| **Sync Delay** | 10s, 30s, 1m, 5m — polling for sync with HQ |

---

## Sync mechanism

- Display listens for commands at `liveUpdateUrl`, e.g. `/stream/display/command/?code={eventCode}`.
- Control page sends commands over that stream (SSE or similar) when buttons are clicked.
- Display updates content without page reload.

---

## Notes

- `/display` is a single endpoint; content is mode-driven by admin commands from `/control`.
- Some control buttons may be in collapsible panels or hidden in DOM; programmatic click can still trigger display updates.
- **Show Online Results Info**, **Show Sponsors**, **Show Slideshow**, **Show Wifi Reminder**, **Show Audience Key**, **Show Safety & Security**, **Show Bracket**, **Show Alliance Selection** — listed in control UI; individual behaviors not all captured in screenshots.
