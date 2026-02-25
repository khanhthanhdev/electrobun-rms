# Match Scheduling Algorithms (Practice + Qualification)

## Overview

This document describes how match scheduling works in the current codebase, including:

- Algorithm internals for practice and qualification schedules
- Full parameter/config behavior and validation rules
- Data structures and persistence model
- API contract and expected responses
- Customization points and safe extension strategy
- Core cases, edge cases, and test coverage guidance

Primary implementation files:

- `src/bun/server/services/event-schedule-service.ts`
- `src/bun/server/api/schedule/schedule.routes.ts`
- `src/bun/server/api/schedule/schedule.schema.ts`
- `src/mainview/pages/events/schedule/components/schedule-metrics.ts`
- `src/mainview/pages/events/schedule/components/schedule-overview.tsx`

## Requirements

### Functional requirements

- Support 1v1 schedules for:
  - Practice (`practice`, `practice_data`, `practice_blocks`, `practice_match_schedule`)
  - Qualification (`quals`, `quals_data`, `blocks`, `match_schedule`)
- Generate, save, list, clear schedules for both schedule types
- Activate/deactivate one schedule type at a time using `config.active_schedule_type`
- Compute match start/end timestamps from schedule config
- Provide quality metrics for qualification schedules and in UI utilities

### Validation and safety requirements

- Event must exist in server DB before any scheduling operation
- Event DB path is sanitized (`/`, `\`, `..` blocked)
- Timestamps must be valid positive Unix milliseconds
- Positive integer checks for `matchesPerTeam`, `cycleTimeSeconds`, `fieldCount`
- Non-negative checks for `fieldStartOffsetSeconds`
- Constraint: `fieldStartOffsetSeconds < cycleTimeSeconds`
- Constraint: qualification `fieldCount <= event.fields`
- Match rows must have unique positive `matchNumber`
- `redTeam` and `blueTeam` must be positive and different

### Non-functional expectations

- Deterministic DB schema migration behavior for legacy lineup columns
- Transactional writes for schedule mutations
- Reasonable fairness under constrained schedule windows

## Detailed Architecture

### Schedule types

- Practice schedule type ID: `1`
- Qualification schedule type ID: `2`
- Active type key: `config.active_schedule_type` (`practice` | `quals` | null)

### Core timing model

Shared function: `computeMatchTimes(matchIndex, startTime, cycleTimeSeconds, { fieldCount, fieldStartOffsetSeconds })`

- `roundIndex = floor(matchIndex / fieldCount)`
- `fieldIndex = matchIndex % fieldCount`
- `startOffset = roundIndex * cycleTime + fieldIndex * fieldOffset`
- `matchTimeSeconds` is fixed to `150` seconds
- `endTime = startTime + 150s`

Implication: matches are packed round-by-round with optional field staggering.

## Data Structure

### Server interfaces

- `OneVsOneScheduleMatch`
  - `matchNumber`, `redTeam`, `blueTeam`, surrogate flags, `startTime`, `endTime`
- `PracticeScheduleResponse`
  - `eventCode`, `isActive`, `matches`, `config`
- `QualificationScheduleResponse`
  - `eventCode`, `isActive`, `matches`, `config`, `metrics`
- `QualificationMetrics`
  - `repeatOpponentPairs`, `maxOpponentRepeat`, `maxSideImbalance`, `averageSideImbalance`, `backToBackCount`, `surrogateSlots`

### SQLite tables

Lineups:

- `practice(match, red, reds, blue, blues)`
- `quals(match, red, reds, blue, blues)`

Match metadata:

- `practice_data(match, status, randomization, start, schedule_start, posted_time, fms_match_id, fms_schedule_detail_id)`
- `quals_data(...)`

Schedule windows:

- `practice_match_schedule(start, end, type, label)`
- `match_schedule(start, end, type, label)`

Blocks:

- `practice_blocks(start, end, type, cycle_time, label)`
- `blocks(start, end, type, cycle_time, label)`

Config:

- `config(key PRIMARY KEY, value)`

Persisted qualification config keys:

- `quals_field_count`
- `quals_field_start_offset_seconds`
- `quals_matches_per_team`

## API Design

All routes require auth + event admin guard.

### Practice routes

- `GET /:eventCode/schedule/practice`
- `PUT /:eventCode/schedule/practice`
- `POST /:eventCode/schedule/practice/generate`
- `DELETE /:eventCode/schedule/practice`
- `PUT /:eventCode/schedule/practice/active` body: `{ "active": boolean }`

Generate body:

- `matchesPerTeam: number >= 1`
- `fieldStartOffsetSeconds?: number >= 0`
- `matchBlocks: [{ startTime, endTime, cycleTimeSeconds }]` (at least one block)

### Qualification routes

- `GET /:eventCode/schedule/quals`
- `PUT /:eventCode/schedule/quals`
- `POST /:eventCode/schedule/quals/generate`
- `DELETE /:eventCode/schedule/quals`
- `PUT /:eventCode/schedule/quals/active` body: `{ "active": boolean }`

Generate body (all optional, defaults applied):

- `startTime`, `cycleTimeSeconds`, `fieldCount`, `fieldStartOffsetSeconds`, `matchesPerTeam`

### Response behavior

- Validation failures return 400 with formatted issue details
- Domain/service errors return 400/404/500 with context-specific error messages
- Successful generate returns 201 + full schedule response

## Scheduling Theory and Algorithms

### 1) Qualification generation (greedy weighted heuristic)

Entry construction:

- Create `matchesPerTeam` entries per team (`isSurrogate=false`)
- If total entries odd, append one surrogate entry for first team

Iterative pairing loop:

1. Pick first entry using `chooseEntryIndex`:
   - Prioritize teams with higher remaining entry counts
   - Penalize surrogate entries (`0.4`)
   - Penalize short rest via `MIN_REST_GAP=3`
2. Pick opponent using `chooseOpponentIndex` minimizing `calculateOpponentCost`
3. Assign red/blue via `chooseSideAssignment` minimizing side imbalance delta
4. Persist pair counters, side counters, and last played round

Opponent cost terms:

- Repeat opponent penalty: `(pairRepeatCount) * 100`
- Rest penalty (per team):
  - gap <= 1 rounds: `500`
  - gap <= 2 rounds: `200`
  - gap <= 3 rounds: `80`
- Side penalty: imbalance delta if assigned
- Surrogate-pair penalty: `25` when both slots are surrogates
- Random tie-break noise

This is a constructive greedy heuristic with dynamic cost; it is not global optimization.

### 2) Practice generation (simulated annealing + block assignment)

### Phase A: build lineup pool

- Build pool with each team index repeated `matchesPerTeam`
- If odd total slots, append surrogate slot for first team
- Shuffle and pair into initial schedule

### Phase B: optimize with simulated annealing

Objective function (`scorePracticeSchedule`, lower is better):

- Opponent duplication: `prevCount^2 * 100`
- Rest gap penalty using same thresholds as qualification

Annealing process:

- Randomly swap two schedule positions across pair slots
- Reject invalid swaps that create same-team matchups
- Accept better candidate always
- Accept worse candidate with probability `exp(-delta / temperature)`
- Temperature starts `100`, cooling factor `0.997`
- Iteration cap: `min(totalMatches * numTeams * 50, 50000)`
- Stop early when score reaches `0`

### Phase C: post-processing

- `balanceSidesInSchedule` greedily flips each pair orientation to reduce red/blue imbalance
- Convert index pairs to team numbers
- Mark surrogate flags when appearances exceed requested `matchesPerTeam`

### Phase D: assign to time blocks

- For each block, generate all start times considering:
  - block duration
  - cycle time
  - field count
  - field offset
- Fill generated lineups into available starts in order
- Persist all scheduled matches and block/window tables

## Parameter and Config Reference

### Global constants

- `DEFAULT_MATCH_TIME_SECONDS = 150`
- `DEFAULT_FIELD_COUNT = 2`
- `DEFAULT_PRACTICE_CYCLE_TIME_SECONDS = 180`
- `DEFAULT_QUALS_CYCLE_TIME_SECONDS = 240`
- `DEFAULT_QUALS_FIELD_START_OFFSET_SECONDS = 15`
- `DEFAULT_QUALS_MATCHES_PER_TEAM = 6`
- `MIN_REST_GAP = 3`

### Practice generation parameters

- `matchesPerTeam`:
  - Required in generate
  - Controls total slots `teamCount * matchesPerTeam`
- `fieldStartOffsetSeconds`:
  - Optional, default `0`
  - Must be `< block.cycleTimeSeconds` for every block
- `matchBlocks[]`:
  - Required, min length `1`
  - `startTime > 0`, `endTime > startTime`, `cycleTimeSeconds >= 1`
  - Total capacity must be `>= ceil(teamCount * matchesPerTeam / 2)`

### Qualification generation parameters

- `startTime`:
  - Optional. If absent: existing quals start -> otherwise `Date.now()`
- `cycleTimeSeconds`:
  - Optional, default `240`
- `fieldCount`:
  - Optional, default event’s configured field count
  - Must be `<= event.fields`
- `fieldStartOffsetSeconds`:
  - Optional, default `15`
  - Must be `< cycleTimeSeconds`
- `matchesPerTeam`:
  - Optional, default `6`

### Qualification persisted config behavior

On generation/save, server persists in `config`:

- `quals_field_count`
- `quals_field_start_offset_seconds`
- `quals_matches_per_team`

On read (`getQualificationSchedule`):

- values are clamped/sanitized
- `fieldStartOffsetSeconds` may be inferred from existing match timestamps when possible

## How to Customize

### 1) Change fairness profile

Adjust weight constants in `event-schedule-service.ts`:

- Opponent repeat penalties (`*100` terms)
- Rest penalties (`500/200/80`)
- Surrogate penalties (`0.4`, `25`)
- `MIN_REST_GAP`

Recommendation: tune one dimension at a time and compare metrics before/after.

### 2) Change scheduling cadence

- Update default cycle constants
- For practice, adjust block-level `cycleTimeSeconds`
- For quals, adjust `cycleTimeSeconds` and `fieldStartOffsetSeconds`

### 3) Change side-balance behavior

- Modify `chooseSideAssignment` (qualification)
- Modify `balanceSidesInSchedule` (practice)

### 4) Introduce deterministic reproducibility

Current seed is `Date.now()`. To make runs reproducible:

- Inject a stable seed input (e.g., eventCode hash + config hash)
- Add optional `seed` to generate API and schema

### 5) Extend metrics

- Server: extend `QualificationMetrics` and computation functions
- Client: extend `OneVsOneScheduleMetrics` + `buildOneVsOneMetricItems`

## Core Cases and Edge Cases

### Core cases

- Even teams, no surrogate required
- Odd total slot count requiring one surrogate slot
- Multiple fields with staggered start offsets
- Save existing manual lineup and recompute timestamps

### Edge cases

- `<2` teams: generation rejected
- Zero/negative timestamps or invalid blocks: rejected
- Duplicate `matchNumber`: rejected
- `redTeam === blueTeam`: rejected
- `fieldCount > event.fields`: rejected
- `fieldStartOffsetSeconds >= cycleTimeSeconds`: rejected
- Practice block capacity too small: rejected with required vs available matches
- Legacy lineup schema present: table reset to 1v1 columns
- Empty schedule read: defaults returned, metrics zeroed

## Test Cases

### Unit tests (algorithm and validation)

1. Qualification: generates expected match count for N teams and M matches/team
2. Qualification: no self-match pairings
3. Qualification: repeat-opponent penalty reduces duplicate pairs vs random baseline
4. Qualification: rest gap penalties reduce back-to-back count
5. Qualification: side assignment minimizes imbalance
6. Practice: simulated annealing score improves from initial schedule
7. Practice: side balancing reduces average side imbalance
8. Practice blocks: capacity formula matches generated start-time count
9. Validation: rejects invalid timestamps/negative params
10. Validation: rejects offset >= cycle

### Integration tests (API + DB)

1. `POST /practice/generate` persists lineups/data/blocks/window atomically
2. `POST /quals/generate` persists config keys and schedule
3. `PUT /practice` and `PUT /quals` persist provided manual lineups
4. `DELETE` clears relevant tables and deactivates active schedule
5. Activation endpoints switch active type correctly
6. Error mapping returns expected status/message for each failure mode

### UI tests

1. Summary cards show config from API (`cycle`, `fieldCount`, `offset`, `matchesPerTeam`)
2. Metric cards render all six metrics correctly
3. Match block editor capacity and desired-match adjustments are consistent

## Guide to Implement New Logic

1. Add/adjust input schema in `schedule.schema.ts`
2. Wire route handling in `schedule.routes.ts`
3. Implement service logic in `event-schedule-service.ts`
4. Persist new config keys in `config` table helpers if needed
5. Update client payload/response types in schedule feature services
6. Update summary/metric components if new config or metrics are added
7. Add unit + integration tests before rollout

## Maintenance Guide

- Keep DB writes wrapped in transactions for all mutating operations
- Keep route validation strict; normalize again in service layer
- Avoid changing metric semantics without versioning or migration notes
- If tuning penalties, compare before/after with a fixed seed benchmark set
- Monitor distribution metrics:
  - repeat opponents
  - side imbalance
  - back-to-back count
  - surrogate slots
- Document any default/constant changes in release notes because they directly affect event operations

## Quick Reference (Current Defaults)

- Match duration: `150s`
- Practice cycle default: `180s`
- Qualification cycle default: `240s`
- Qualification field offset default: `15s`
- Qualification matches per team default: `6`
- Minimum rest target: `3` rounds
