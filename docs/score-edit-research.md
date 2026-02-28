# Score Edit Research Report

**Target:** `http://172.16.12.215/event/1234/control/#edit-4`  
**Login:** username `local`, no password  
**Date:** 2026-02-28

---

## 1. Browser Session Summary

### Login Page (Redirect)

Navigation to `/event/1234/control/#edit-4` redirects to **login** (`http://172.16.12.215/login/#edit-4`), so auth is required.

**Login UI:**
- **Username:** text input, placeholder "Enter username"
- **Password:** text input, placeholder "Password" (empty for default user)
- **Default user:** username `local`, no password
- **Shortcut:** "Click here to select a default user" link
- **Alternatives:** QR code login (Scan QR, QR Help)
- **Environment note:** Red banner warns "The FTC Scoring software does not support Electron. Please use a supported browser."

### Hash Routing

`#edit-4` in the URL likely selects tab index 4 in the control page. The live FTC app at 172.16.12.215 appears to use hash-based tab routing.

---

## 2. Score Edit — Codebase Implementation

From `event-control-page.tsx` and `match-control.md`.

### Tab Structure

| Tab ID       | Label             | Purpose                    |
|--------------|-------------------|----------------------------|
| schedule     | Schedule          | Full match schedule        |
| incomplete   | Incomplete Matches| In-progress matches        |
| **score-edit** | **Score Edit**  | Score adjustment for committed matches |
| active       | Active Match      | Live scoring panels        |
| settings     | Settings          | Event config               |

### ScoreEditPanel Behavior

```tsx
// event-control-page.tsx:410-508
```

**Features:**
1. **Match selector** — dropdown of COMMITTED matches with format:  
   `{matchName} — Red {redScore} · Blue {blueScore}`
2. **Score display** — Red/Blue alliance scores for the selected match
3. **Actions:**
   - **Open Scoresheet** → `/event/{eventCode}/match/{matchName}` (read-only view)
   - **Edit Red Scores** → `/event/{eventCode}/ref/red/scoring/{fieldNumber}/match/{matchNumber}`
   - **Edit Blue Scores** → `/event/{eventCode}/ref/blue/scoring/{fieldNumber}/match/{matchNumber}`

**Data:**
- Shows only COMMITTED matches (`row.state === "COMMITTED"`)
- Uses `editMatchNumber` to pick which match to edit
- Loads from `useMatchControlData` → `rows` (schedule / match control data)

---

## 3. Edit Flow (ScoringEntryPage)

After choosing "Edit Red Scores" or "Edit Blue Scores", the user is sent to **ScoringEntryPage**.

### Scoring sections (Flag Defense)

| Section | Category          | Mechanics                                      |
|---------|-------------------|------------------------------------------------|
| A       | Flags Defended    | L2 (25), L1 (20), Center (10)                  |
| B       | Flag Offense      | Center (30), Other (10)                        |
| C       | Bullet Penalty    | −10 per bullet in enemy backfield              |
| D       | Endgame           | Robot parking (0/10/15) + golden flag (10 each)|

### State structure (`ScoringState`)

```typescript
interface ScoringState {
  flagsL2Defended: number;
  flagsL1Defended: number;
  flagsCenterDefended: number;
  flagsCenterShot: number;
  flagsOtherShot: number;
  bulletsInEnemyZone: number;
  robotParking: 0 | 1 | 2;      // 0=None, 1=Partial 10pts, 2=Full 15pts
  goldenFlagsBonus: number;
}
```

### Total score

```
Total = (A) + (B) − (C) + (D)
```

---

## 4. URL Patterns

| Route | Purpose |
|-------|---------|
| `/event/1234/control/#edit-4` | Control page, Score Edit tab (hash routing) |
| `/event/1234/match/{matchName}` | Scoresheet (read-only) |
| `/event/1234/ref/red/scoring/{field}/match/{num}` | Red alliance score entry |
| `/event/1234/ref/blue/scoring/{field}/match/{num}` | Blue alliance score entry |

---

## 5. Constraints

1. **Electron:** The FTC app shows a warning that it does not support Electron (e.g. Electrobun). Use Chrome/Firefox/etc. for testing.
2. **Auth:** Must log in before accessing `/event/1234/control/`.
3. **Edit availability:** Only COMMITTED matches appear in the Score Edit panel.
4. **Data source:** Score Edit uses `useMatchControlData` for schedule and match data.

---

## 6. Open Questions

- Exact mapping of `#edit-4` to tabs in the live FTC app at 172.16.12.215
- Whether the external app uses the same Score Edit layout/behavior as our codebase
- API endpoints used for score updates and match control

---

## Appendix: Login Screenshot

Saved as `docs/score-edit-research-login.png` (captured during browser session).
