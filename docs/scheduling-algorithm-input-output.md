# Scheduling Algorithm Input and Output Contract

## Purpose

This document defines the input and output contract for the current 1v1 match scheduling algorithms.

It covers:

- Practice schedule generation
- Qualification schedule generation
- Manual schedule save/import
- Shared output shape
- Metrics output
- Validation and current UI behavior

Primary implementation files:

- `src/bun/server/api/schedule/schedule.schema.ts`
- `src/bun/server/application/dtos/schedule/index.ts`
- `src/bun/server/application/use-cases/schedule/generate-practice-schedule.ts`
- `src/bun/server/application/use-cases/schedule/generate-qualification-schedule.ts`
- `src/bun/server/application/use-cases/schedule/practice-generation.ts`
- `src/bun/server/application/use-cases/schedule/qualification-generation.ts`
- `src/mainview/pages/events/schedule/practice-schedule-page.tsx`
- `src/mainview/pages/events/schedule/qualification-schedule-page.tsx`

## Shared Terms

### Schedule Type

The system supports two 1v1 schedule types:

| Type | API path segment | Lineup table | Data table | Window table | Blocks table |
| --- | --- | --- | --- | --- | --- |
| Practice | `practice` | `practice` | `practice_data` | `practice_match_schedule` | `practice_blocks` |
| Qualification | `quals` | `quals` | `quals_data` | `match_schedule` | `blocks` |

### Match Slot

A generated or saved match is a 1v1 slot:

```ts
interface OneVsOneScheduleMatch {
  matchNumber: number;
  redTeam: number;
  redSurrogate: boolean;
  blueTeam: number;
  blueSurrogate: boolean;
  startTime: number;
  endTime: number;
}
```

`startTime` and `endTime` are Unix timestamps in milliseconds.

`redSurrogate` and `blueSurrogate` identify extra appearances added only to make an odd total slot count schedulable. A surrogate appearance does not count as a normal required match for that team.

### Timing Model

The shared timing model packs matches round-by-round:

```text
roundIndex = floor(matchIndex / fieldCount)
fieldIndex = matchIndex % fieldCount
startTime = scheduleStart + (roundIndex * cycleTimeSeconds) + (fieldIndex * fieldStartOffsetSeconds)
endTime = startTime + matchTimeSeconds
```

Current default `matchTimeSeconds` is `480`.

`fieldStartOffsetSeconds` is a stagger between fields in the same round. It must be smaller than `cycleTimeSeconds`.

## Event Context Input

Both generators depend on event context loaded from the event database:

```ts
interface ScheduleEventContext {
  teamNumbers: number[];
  fieldCount: number;
}
```

`teamNumbers` is the sorted list of team numbers found in event team tables.

`fieldCount` is the event configured field count. Practice generation always uses this value. Qualification generation may accept a smaller configured field count, but not a larger one.

Generation fails when fewer than two teams exist.

## Practice Generation Input

Endpoint:

```http
POST /:eventCode/schedule/practice/generate
```

Request body:

```ts
interface GeneratePracticeScheduleInput {
  matchesPerTeam: number;
  fieldStartOffsetSeconds?: number;
  matchBlocks: MatchBlockInput[];
}

interface MatchBlockInput {
  startTime: number;
  endTime: number;
  cycleTimeSeconds: number;
}
```

### Practice Input Fields

| Field | Required | Default | Rules | Meaning |
| --- | --- | --- | --- | --- |
| `matchesPerTeam` | Yes | None | Positive whole number | Normal appearances required per team |
| `fieldStartOffsetSeconds` | No | `0` | Non-negative whole number; must be less than every block cycle time | Field stagger inside each round |
| `matchBlocks` | Yes | None | Array length at least `1` | Time windows where matches may be scheduled |
| `matchBlocks[].startTime` | Yes | None | Positive finite Unix millisecond timestamp | Start of a schedulable block |
| `matchBlocks[].endTime` | Yes | None | Must be after `startTime` | End of a schedulable block |
| `matchBlocks[].cycleTimeSeconds` | Yes | None | Positive whole number | Round cadence for that block |

### Practice Derived Inputs

The backend derives:

```text
totalMatchesNeeded = ceil(teamCount * matchesPerTeam / 2)
totalCapacity = sum(capacity for each match block)
```

Block capacity is computed from block duration, event field count, cycle time, and field offset.

If `totalCapacity < totalMatchesNeeded`, generation is rejected.

### Practice Algorithm Output

The practice generator returns and persists:

```ts
interface PracticeScheduleResponse {
  eventCode: string;
  isActive: boolean;
  matches: OneVsOneScheduleMatch[];
  config: PracticeScheduleConfig;
}

interface PracticeScheduleConfig {
  startTime: number | null;
  cycleTimeSeconds: number;
  fieldCount: number;
  fieldStartOffsetSeconds: number;
  matchTimeSeconds: number;
}
```

Output behavior:

- `matches.length` is at most `ceil(teamCount * matchesPerTeam / 2)`.
- Every match has unique ascending `matchNumber`.
- Teams are paired by optimized 1v1 lineups, then assigned into block start times.
- If `teamCount * matchesPerTeam` is odd, one surrogate slot is added.
- `config.startTime` is the first block start time after persistence.
- `config.fieldCount` is the event field count.
- `config.cycleTimeSeconds` is loaded from the first persisted block.

## Qualification Generation Input

Endpoint:

```http
POST /:eventCode/schedule/quals/generate
```

Request body:

```ts
interface GenerateQualificationScheduleInput {
  startTime?: number;
  cycleTimeSeconds?: number;
  fieldCount?: number;
  fieldStartOffsetSeconds?: number;
  matchesPerTeam?: number;
}
```

### Qualification Input Fields

| Field | Required | Default | Rules | Meaning |
| --- | --- | --- | --- | --- |
| `startTime` | No | Existing qualification start time, otherwise current time | Positive finite Unix millisecond timestamp | First match start |
| `cycleTimeSeconds` | No | Season default, currently `240` | Positive whole number | Round cadence |
| `fieldCount` | No | Event field count | Positive whole number; cannot exceed event field count | Number of active fields to schedule across |
| `fieldStartOffsetSeconds` | No | Season default, currently `15` | Non-negative whole number; must be less than `cycleTimeSeconds` | Field stagger inside each round |
| `matchesPerTeam` | No | Season default, currently `6` | Positive whole number | Normal appearances required per team |

### Qualification Current UI Input Behavior

The qualification UI reuses the match block editor for date, start time, cycle time, and capacity display. Current backend generation only consumes:

- First block start time
- First block cycle time
- Field count
- Field offset
- Matches per team

Current backend generation does not consume:

- First block end time
- Additional match blocks
- Desired block match count as a hard capacity limit

Operational implication: the UI may show a block capacity, but qualification generation currently schedules the full required match count from the first start time.

### Qualification Algorithm Output

The qualification generator returns and persists:

```ts
interface QualificationScheduleResponse {
  eventCode: string;
  isActive: boolean;
  matches: OneVsOneScheduleMatch[];
  metrics: QualificationMetrics;
  config: QualificationScheduleConfig;
}

interface QualificationScheduleConfig {
  startTime: number | null;
  cycleTimeSeconds: number;
  fieldCount: number;
  fieldStartOffsetSeconds: number;
  matchesPerTeam: number;
  matchTimeSeconds: number;
}
```

Output behavior:

- `matches.length` is `ceil(teamCount * matchesPerTeam / 2)`.
- Every match has unique ascending `matchNumber`.
- Matches are assigned by greedy weighted pairing.
- Match times are computed directly from `startTime`, `cycleTimeSeconds`, `fieldCount`, and `fieldStartOffsetSeconds`.
- If `teamCount * matchesPerTeam` is odd, one surrogate slot is added for the first team.
- Qualification config keys are persisted to the event DB `config` table.

## Manual Save and CSV Import Input

Manual save and CSV import use the save endpoints.

Practice:

```http
PUT /:eventCode/schedule/practice
```

```ts
interface SavePracticeScheduleInput {
  startTime: number;
  cycleTimeSeconds?: number;
  matches: SaveOneVsOneScheduleMatchInput[];
}
```

Qualification:

```http
PUT /:eventCode/schedule/quals
```

```ts
interface SaveQualificationScheduleInput {
  startTime: number;
  cycleTimeSeconds?: number;
  fieldCount?: number;
  fieldStartOffsetSeconds?: number;
  matches: SaveOneVsOneScheduleMatchInput[];
}
```

Shared match row input:

```ts
interface SaveOneVsOneScheduleMatchInput {
  matchNumber: number;
  redTeam: number;
  redSurrogate?: boolean;
  blueTeam: number;
  blueSurrogate?: boolean;
}
```

### Manual Save Validation

Each match row must satisfy:

- `matchNumber` is a positive whole number.
- `matchNumber` is unique in the payload.
- `redTeam` is a positive whole number.
- `blueTeam` is a positive whole number.
- `redTeam !== blueTeam`.

Manual save recomputes match timing from the submitted order/config. It does not preserve imported CSV timestamps per row; it uses the submitted `startTime`, `cycleTimeSeconds`, field count, and field offset.

For qualification saves, `matchesPerTeam` is inferred from the maximum non-surrogate appearance count in the submitted matches.

## Metrics Output

Qualification responses include metrics:

```ts
interface QualificationMetrics {
  repeatOpponentPairs: number;
  maxOpponentRepeat: number;
  maxSideImbalance: number;
  averageSideImbalance: number;
  backToBackCount: number;
  surrogateSlots: number;
}
```

| Metric | Meaning |
| --- | --- |
| `repeatOpponentPairs` | Total extra pairings beyond first pairing for all repeated opponent pairs |
| `maxOpponentRepeat` | Highest count for any opponent pair; `1` when no repeats exist |
| `maxSideImbalance` | Largest absolute red-vs-blue appearance imbalance for any team |
| `averageSideImbalance` | Average absolute side imbalance across teams in the schedule |
| `backToBackCount` | Count of adjacent match numbers where the same team appears in consecutive matches |
| `surrogateSlots` | Count of match slots marked surrogate |

Practice responses do not include server-side metrics. The UI computes comparable display metrics client-side from practice matches.

## Persistence Output

Generation and save operations persist four categories of output:

1. Lineup rows
2. Match data rows
3. Schedule window rows
4. Block/config rows

Lineup rows store match number, red team, blue team, and surrogate flags.

Match data rows store status, start time, schedule start time, and generated local IDs.

Schedule window rows store the schedule start/end range and schedule type label.

Qualification additionally stores:

- `quals_field_count`
- `quals_field_start_offset_seconds`
- `quals_matches_per_team`

## Error Output

Validation failures return HTTP `400` with a JSON body similar to:

```json
{
  "error": "Validation failed",
  "message": "fieldStartOffsetSeconds: Invalid value"
}
```

Use-case validation failures return HTTP `400` with the route-specific error label and the application message:

```json
{
  "error": "Failed to generate qualification schedule",
  "message": "fieldStartOffsetSeconds must be smaller than cycleTimeSeconds."
}
```

Unauthenticated writes return:

```json
{
  "error": "Unauthorized"
}
```

## Worked Examples

### Practice Generate Request

```json
{
  "matchesPerTeam": 1,
  "fieldStartOffsetSeconds": 30,
  "matchBlocks": [
    {
      "startTime": 1710001000000,
      "endTime": 1710001300000,
      "cycleTimeSeconds": 180
    }
  ]
}
```

For four teams and two fields, expected output:

- Two generated matches
- Each team appears once
- `config.startTime = 1710001000000`
- `config.fieldStartOffsetSeconds = 30`

### Qualification Generate Request

```json
{
  "startTime": 1710003000000,
  "cycleTimeSeconds": 240,
  "fieldCount": 2,
  "fieldStartOffsetSeconds": 15,
  "matchesPerTeam": 1
}
```

For four teams, expected output:

- Two generated matches
- Match 1 starts at `1710003000000`
- Match 2 starts at `1710003015000`
- Each team appears once
- Metrics report no repeat opponents and no surrogate slots

## Current Contract Gaps

These are current behavior notes, not desired long-term constraints:

- Qualification generation is not seed-reproducible because the pairing randomizer uses the current time.
- Qualification generation does not enforce a user-entered block end time or total capacity.
- Qualification field count is capped by backend validation, but the current UI does not pass a max field count to the input.
- Field offset is validated by backend, but the current UI can allow offset values greater than or equal to cycle time before submit.

## Recommended Tests

Add or maintain tests for:

- Practice rejects insufficient block capacity.
- Practice maps block windows to generated start times.
- Qualification produces exactly `ceil(teamCount * matchesPerTeam / 2)` matches.
- Qualification rejects `fieldCount` above event field count.
- Qualification rejects `fieldStartOffsetSeconds >= cycleTimeSeconds`.
- Manual save rejects duplicate match numbers and self-matches.
- Qualification metrics count repeat opponents, side imbalance, back-to-back matches, and surrogate slots correctly.
