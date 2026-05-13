# Event, Match, Scoring, and Ranking Schemas

This document summarizes the schema shapes used by the event DB and the API payload validators in:

- `src/bun/db/schema.ts`
- `src/bun/event-db/schema.ts`
- `src/bun/server/api/events/events.schema.ts`
- `src/bun/server/api/scoring/scoring.schema.ts`
- `src/bun/server/application/dtos/ranking/index.ts`
- `src/bun/server/application/dtos/scoring/scoring-types.ts`

## 1. Event schema

### 1.1 Event table

Source: `src/bun/db/schema.ts`

```ts
type Event = {
  code: string;
  name: string;
  type: number;
  status: number;
  finals: number;
  divisions: number;
  fields: number;
  start: number;
  end: number;
  region: string;
};
```

### 1.2 Manual event body

Source: `src/bun/server/api/events/events.schema.ts`

```ts
type ManualEventBody = {
  eventCode: string;
  eventName: string;
  region: string;
  eventType: number;
  startDate: string;
  endDate: string;
  divisions: number;
  fields?: number;
  finals?: number;
  status?: number;
};
```

Rules:

- `eventCode` is normalized before validation.
- `eventCode` must match the event code regex.
- `eventName` length: 1 to 256.
- `region` length: 1 to 64.

### 1.3 Update event body

Source: `src/bun/server/api/events/events.schema.ts`

```ts
type UpdateEventBody = {
  eventName: string;
  region: string;
  eventType: number;
  startDate: string;
  endDate: string;
  divisions: number;
  fields?: number;
  finals?: number;
  status?: number;
};
```

## 2. Match schema

### 2.1 Match types

Source: `src/bun/server/application/dtos/scoring/scoring-types.ts`

```ts
type MatchType = "practice" | "quals" | "elims";
type AllianceColor = "red" | "blue";
```

### 2.2 Match-related event DB tables

Source: `src/bun/event-db/schema.ts`

The event DB stores separate tables for each match category:

- `practice`
- `practice_data`
- `practice_results`
- `quals`
- `quals_data`
- `quals_results`
- `quals_scores`
- `quals_game_specific`
- `elims`
- `elims_data`
- `elims_results`
- `elims_scores`
- `elims_game_specific`

### 2.3 Match row shapes

```ts
type PracticeMatch = {
  match: number;
  red: number;
  reds: number;
  blue: number;
  blues: number;
};

type QualsMatch = {
  match: number;
  red: number;
  reds: number;
  blue: number;
  blues: number;
};

type ElimsMatch = {
  match: number;
  red: number;
  blue: number;
};

type MatchData = {
  match: number;
  status: number;
  randomization: number;
  start: number;
  scheduleStart: number;
  postedTime: number;
  fmsMatchId: string;
  fmsScheduleDetailId: string;
};
```

### 2.4 Match result rows

```ts
type PracticeResults = {
  match: number;
  redScore: number;
  blueScore: number;
  redPenaltyCommitted: number;
  bluePenaltyCommitted: number;
};

type QualsResults = {
  match: number;
  redScore: number;
  blueScore: number;
  redPenaltyCommitted: number;
  bluePenaltyCommitted: number;
};

type ElimsResults = {
  match: number;
  redScore: number;
  blueScore: number;
  redPenaltyCommitted: number;
  bluePenaltyCommitted: number;
};
```

## 3. Scoring schema

### 3.1 Save match alliance score body

Source: `src/bun/server/api/scoring/scoring.schema.ts`

```ts
type SaveMatchAllianceScoreBody = {
  matchType: "practice" | "quals" | "elims";
  matchNumber: number;
  alliance: "red" | "blue";
  aSecondTierFlags: number;
  aFirstTierFlags: number;
  aCenterFlags: number;
  bCenterFlagDown: number;
  bBaseFlagsDown: number;
  cOpponentBackfieldBullets: number;
  dRobotParkState: number;
  dGoldFlagsDefended: number;
};
```

Validation rules:

- `matchType` must be one of `practice`, `quals`, `elims`.
- `matchNumber` must be `>= 1`.
- `alliance` must be `red` or `blue`.
- All score fields are numeric and non-negative.
- `bCenterFlagDown` is constrained to `0..1`.
- `dRobotParkState` is constrained to `0..2`.

### 3.2 Scoring breakdown

The scoring data is split into 4 groups:

- `A` - `aSecondTierFlags`, `aFirstTierFlags`, `aCenterFlags`
- `B` - `bCenterFlagDown`, `bBaseFlagsDown`
- `C` - `cOpponentBackfieldBullets`
- `D` - `dRobotParkState`, `dGoldFlagsDefended`

## 4. Ranking schema

### 4.1 Qualification ranking item

Source: `src/bun/server/application/dtos/ranking/index.ts`

```ts
type QualificationRankingItem = {
  losses: number;
  name: string;
  played: number;
  rank: number;
  rankingPoint: number;
  teamNumber: number;
  ties: number;
  total: number;
  wins: number;
};
```

### 4.2 Qualification rankings response

```ts
type EventQualificationRankingsResponse = {
  eventCode: string;
  rankings: QualificationRankingItem[];
};
```

### 4.3 Team ranking DB row

Source: `src/bun/event-db/schema.ts`

```ts
type TeamRankingRow = {
  fmsEventId: string;
  fmsTeamId: string;
  ranking: number;
  rankChange: number;
  wins: number;
  losses: number;
  ties: number;
  qualifyingScore: string;
  pointsScoredTotal: number;
  pointsScoredAverage: string;
  pointsScoredAverageChange: number;
  matchesPlayed: number;
  matchesCounted: number;
  disqualified: number;
  sortOrder1: string;
  sortOrder2: string;
  sortOrder3: string;
  sortOrder4: string;
  sortOrder5: string;
  sortOrder6: string;
  modifiedOn: string;
};
```

## 5. Practical notes

- The `event-db/schema.ts` file defines the persistent SQLite layout for match and ranking data.
- The API schema files define request validation, not the full persisted record structure.
- `MatchType` is the canonical discriminator for scoring routes and match-specific payloads.
- Ranking data appears in two forms:
  - `QualificationRankingItem` for API responses
  - `team_ranking` for persisted event DB rows

