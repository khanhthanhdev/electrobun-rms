# Event 111 Audience Display Research (FTCLive v7.2.6)

This document is based on live inspections performed on:
- **2026-02-09**: audience display `http://172.21.32.1/event/111/display/`, admin `http://172.21.32.1/event/111/control/#video`
- **2026-02-10**: audience display `http://172.16.15.216/event/111/display/`, admin match control `http://172.16.15.216/event/111/control/`

## What Was Verified
### Admin Control Access (Local User)
- On `172.21.32.1`: opening `/event/111/control/#video` redirected to `/login/` and could not be inspected without credentials/QR.
- On `172.16.15.216`: `/event/111/control/` loaded directly and match control could be exercised.
- On `172.16.15.216`, `Show Match` + `Start Match` were initially disabled until clicking `Randomize Field`, after which both actions became enabled.
### Audience Display: Visual State
- Closing the settings modal shows a full-screen “Decode” background with minimal chrome and a small gear button to reopen settings.
- Screenshot captured: `docs/assets/event-111-display-2026-02-09.png`

### Audience Display: Match Preview (Likely “Show Match” State)
While the admin `/control` page was not accessible (login required), the `/display` page was observed in a match-preview layout consistent with what “Show Match” typically does:
- Field + timer header: `Field 2` and timer initialized at `2:30` (not counting down).
- Match label: `TEST Qualification 4 of 5`
- Team numbers shown (as rendered on the display): `2 1 4 3` (likely Red: `2, 1` vs Blue: `4, 3`)
- Score line: `Red 0  Blue 0`
- Score breakdown lines were present in the accessibility snapshot (values were `0 0 /36` on both rows during this observation).

Evidence captured:
- Screenshots:
  - `docs/assets/event-111-display-timer-2026-02-09-2347.png`
  - `docs/assets/event-111-display-timer-2026-02-09-2350.png`
- Accessibility snapshot excerpt (compact): shows the text lines above.

### Audience Display: Idle / Up Next (172.16.15.216)
- After closing the settings modal, the display showed an “Up Next” layout (not the full match timer view yet).
- Screenshot captured: `docs/assets/event-111-display-216-idle-2026-02-10.png`

#### Bind-To-Field Behavior (Audience Display)
Changing `Bind to Field` in Display Settings materially changes what the audience display renders:
- Bound to `Field 1`: the match-preview/timer view was replaced by a minimal status line: `Next match expected start: 2:41+`
  - Screenshot: `docs/assets/event-111-display-bound-field1-2026-02-09.png`
- Bound to `Field 2`: the match-preview/timer view appeared (Field 2 + Qualification 4 of 5, etc.)
  - Screenshot: `docs/assets/event-111-display-bound-field2-2026-02-09.png`

### Audience Display: Settings Modal (On Load)
The display opens with a “Display Options” / “Display Settings” modal. Verified controls include:
- Display identity:
  - `Display Name` (text input)
  - `Display Type` (Audience, Field, Pit, Sponsor, Championship Bar)
  - `Bind to Field` ((All), Field 1, Field 2)
- Timer / overlay:
  - `Use field-style timer (with a big timer in the middle of the screen)` (radio)
  - `Use Overlay` (radio)
  - `Overlay Settings` includes `Pick Color`
- Format options:
  - `Alliance Selection Display`: Classic, Hybrid
  - `Awards Display`: Classic, Overlay
- Advanced settings:
  - `Scoring Bar Location`: Bottom, Top
  - `Alliance Orientation`: Standard (Red on Left), Flipped (Red on Right)
  - `Rankings Font Size`: Larger, Smaller (for screens closer to the viewers)
  - `Mute`
  - `Mute Results`
- Actions:
  - `Fullscreen`, `Recenter`, `Cancel`, `Save`, and Close (`×`)

Screenshot captured:
- `docs/assets/event-111-display-settings-2026-02-09.png`

### Audience Display: Audio Behavior
- The page can show an “Audio Warning” stating the display is set to play sounds but cannot yet, prompting a click-to-unmute flow (autoplay restriction).
- The settings modal also exposes an “Audio Testing” section with match cue labels (e.g., MATCH start / AUTO end / TELEOP start / 30-second Warning / MATCH abort) and a `Play` control.

### Audience Display: Client-Side Configuration (`window.displayParams`)
The page defines `window.displayParams` with event and stream endpoints (values as observed):
- `eventCode`: `"111"`
- `eventName`: `"TEST"`
- `fieldCount`: `2`
- `style`: `"default"`
- `liveDisabled`: `false`
- `liveUpdateUrl`: `"/stream/display/command/?code=111"`
- `inspectionStatusUpdateUrl`: `"/stream/inspection/?code=111"`
- `sponsorsUrl`: `"/event/111/dashboard/sponsorsjson/get/"`
- `showMeetRankings`: `true`
- `matchTiming` (ISO-8601 durations):
  - `auto`: `"PT30S"`
  - `transition`: `"PT8S"`
  - `teleop`: `"PT2M"`
  - `endgameWarning`: `"PT20S"`
  - `total`: `"PT2M38S"`

## Solution: RMS Timer Sync (Implementation Notes)
If you want RMS `/display` to stay in sync the same way (single authoritative start, clients count down consistently), the pattern is:
- Server sends one authoritative snapshot on `start`/`pause`/`reset` and publishes `timer.updated` over the stage SSE stream.
- Clients compute a stable server clock offset from `serverNowMs` and tick down locally once per second.
- On every `timer.updated`, clients refresh the base state and offset.

In this repo, that wiring lives in:
- Server timer source of truth: `apps/server/src/services/match-timer.ts`
- Server timer routes + publish: `apps/server/src/routes/tournaments/matches.routes.ts`
- Server SSE stream: `apps/server/src/routes/tournaments/events.routes.ts`
- Client timer sync hook: `apps/web/src/hooks/use-match-timer.ts`
- Audience display renders the scoreboard (which uses `useMatchTimer`): `apps/web/src/components/live/AudienceDisplayRenderer.tsx`

## Admin-Driven Match Start (“Start Match”) — Countdown Verified (172.16.15.216)
After enabling match control (via `Randomize Field`) and clicking `Show Match`, the audience display switched into the match view with the full timer:
- Screenshot: `docs/assets/event-111-display-216-after-show-match-2026-02-10.png`

Clicking `Start Match` caused the timer to count down on the audience display:
- T+0s: `docs/assets/event-111-display-216-start-t0-2026-02-10.png`
- T+3s: `docs/assets/event-111-display-216-start-t3-2026-02-10.png`
- T+6s: `docs/assets/event-111-display-216-start-t6-2026-02-10.png`
- T+30s: `docs/assets/event-111-display-216-start-t30-2026-02-10.png`
- T+60s: `docs/assets/event-111-display-216-start-t60-2026-02-10.png`
- End: `docs/assets/event-111-display-216-end-2026-02-10.png`

Notes:
- The timer line included a phase/status glyph next to the time; the glyph changed between early and later timestamps (likely reflecting phase transitions such as AUTO -> TELEOP).

### Admin Evidence (172.16.15.216)
- Loading the match from the schedule showed a “Load” dialog:
  - `docs/assets/event-111-control-216-play-dialog-2026-02-10.png`

## How Admin Likely Controls the Display (Inference From Verified Endpoints)
Based on the verified audience-side configuration:
- The audience display listens for mode/content changes via `window.displayParams.liveUpdateUrl` (`/stream/display/command/?code=111`).
- The admin `control/#video` page likely publishes commands that drive display mode changes over that same event-scoped command stream.

This mapping (slideshow/sponsors/video switch/etc.) is **not** fully mapped in this document (only Show Match + Start Match were exercised on `172.16.15.216`).

## Next Steps To Complete The Admin Mapping
To fully document all display modes, capture:
1. `Video Switch` tab actions (Sponsors, Slideshow, Message, Blank, etc.) and the resulting `/display` visuals.
2. Additional timer phase transition screenshots near the configured `matchTiming` boundaries (AUTO end, transition, endgame warning).
