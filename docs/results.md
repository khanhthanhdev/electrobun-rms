# Match Results Feature Design Guidelines

## 1. Match Results Page

**URL Path:** `/event/$eventcode/results/`

This page displays a comprehensive list of all matches and their results. The table features a specific column layout to easily compare Red and Blue alliance scores.

### ASCII Wireframe

```text
<< Back to Event Home

[x] Condensed  [ ] Keep Background on Print                     NRC 2026 Match Results

| Match | Red (Team # + Name)       | Red Score | Blue Score | Blue (Team # + Name)       | Score breakdown        | History              |
|-------|---------------------------|-----------|------------|----------------------------|------------------------|----------------------|
| Q1    | [R] 5 - Team Alpha        |    134    |     74     | [B] 1 - Team Beta          |       [Scoresheet]     | [View Match History] |
|       | [R] 2 - Team Gamma        |           |            | [B] 10 - Team Delta        |  [Red]            [Blue|                      |
|-------|---------------------------|-----------|------------|----------------------------|------------------------|----------------------|
| Q2    | [R] 3 - Cyber Knights     |     9     |      9     | [B] 7 - Robo Rams          |       [Scoresheet]     | [View Match History] |
|       | [R] 4 - Iron Giants       |           |            | [B] 13 - Tech Titans       |  [Red]            [Blue|                      |
|-------|---------------------------|-----------|------------|----------------------------|------------------------|----------------------|
| Q3    | [R] 14 - Apollo           |    87     |     92     | [B] 9 - Artemis            |       [Scoresheet]     | [View Match History] |
|       | [R] 12 - Zeus             |           |            | [B] 6 - Athena             |  [Red]            [Blue|                      |
```

*Notes:*
- **Red column:** Displays Team Number and Team Name for the Red Alliance. Background color slightly tinted red if not condensed.
- **Red Score / Blue Score columns:** Display the scores for each alliance. The winning score background should be highlighted in its respective alliance color (Red for Red win, Blue for Blue win, Grey/unhighlighted for Tie).
- **Blue column:** Displays Team Number and Team Name for the Blue Alliance. Background tinted blue if not condensed.
- **Score breakdown:** Contains a central link to the full match scoresheet, and respective links for just the Red or Blue scoresheet.

---

## 2. Match History Page

**URL Path:** `/event/$eventcode/match/$matchName/history`

This page displays the audit log/history of a specific match, showing how the score changed over time through commits and edits.

### ASCII Wireframe

```text
<< Back to Match Results

                                      1234
                                 History for Q1

                                Most Recent First

| Type             | Time                    | Red Score | Blue Score | Scoresheet   |
|------------------|-------------------------|-----------|------------|--------------|
| Commit           | 2026-02-19 08:28:31 AM  |    134    |     74     | [Scoresheet] |
| Scorekeeper Edit | 2026-02-19 08:28:30 AM  |    134    |     74     | [Scoresheet] |
| Ref Save         | 2026-02-19 08:26:15 AM  |    120    |     74     | [Scoresheet] |
```

*Notes:*
- Lists history events (Commits, Edits) related to the match score.
- **Type:** Shows the action that triggered the history entry.
- **Winner indicator:** The winning score (Red or Blue) can have its background highlighted with the winning color.

---

## 3. Scoresheet Pages

**URL Paths:**
- Full Match: `/event/$eventcode/match/$matchName/`
- Single Alliance: `/event/$eventcode/match/$matchName/red` (or `/blue`)

Displays the detailed scoresheet. The layout strictly follows the current score entry design, rendering as a read-only view.

### ASCII Wireframe (Full Match View)

```text
<< Back to Match Results

+-----------------------------------------+   +-----------------------------------------+
| [▉] Blue Alliance Scoring       [M1][F1]|   | [▉] Red Alliance Scoring        [M1][F1]|
+-----------------------------------------+   +-----------------------------------------+
| ▉ A - Cờ bảo vệ (Defended Flags)        |   | ▉ A - Cờ bảo vệ (Defended Flags)        |
|   Tier 2 Flags (25 pts)          1      |   |   Tier 2 Flags (25 pts)          0      |
|   Tier 1 Flags (20 pts)          2      |   |   Tier 1 Flags (20 pts)          3      |
|   Center Flags (10 pts)          1      |   |   Center Flags (10 pts)          1      |
|                                         |   |                                         |
| ▉ B - Bắn phá (Flags Shot)              |   | ▉ B - Bắn phá (Flags Shot)              |
|   Enemy Center Flag (30)         0      |   |   Enemy Center Flag (30)         1      |
|   Other Enemy Flags (10)         3      |   |   Other Enemy Flags (10)         2      |
|                                         |   |                                         |
| ▉ C - Đạn trên sân đối phương           |   | ▉ C - Đạn trên sân đối phương           |
|   Bullets (cancels flags)        0      |   |   Bullets (cancels flags)        1      |
|                                         |   |                                         |
| ▉ D - Endgame                           |   | ▉ D - Endgame                           |
|   Robot 1 Parking:            Partial   |   |   Robot 1 Parking:            No        |
|   Robot 2 Parking:            Full      |   |   Robot 2 Parking:            Full      |
|   Golden Flags Base (10)         1      |   |   Golden Flags Base (10)         0      |
|                                         |   |                                         |
| [ Total Score                    140 ]  |   | [ Total Score                    130 ]  |
+-----------------------------------------+   +-----------------------------------------+
```

*Notes:*
- When viewing `/red` or `/blue`, only that specific side is displayed, using the full width.
- When viewing the combined path `/`, both red and blue sides are displayed side-by-side on desktop, or stacked on mobile devices.
- The UI contains four main sections (A, B, C, D) corresponding to the scoring rules in `docs/score.md`.
- Values are centered or aligned to match the read-only result display.
- Robot parking states are shown as text (e.g., "Partial", "Full", "No") instead of interactive buttons.
- This is a read-only view for the results page.
