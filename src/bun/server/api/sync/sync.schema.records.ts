import {
  array,
  boolean,
  number,
  object,
  optional,
  picklist,
  string,
} from "valibot";

// Record Schemas for Sync API Resources

// 1. Inspection Schedule
export const inspectionScheduleRecordSchema = object({
  externalInspectionItemId: optional(string()),
  teamNumber: string(),
  stationNumber: optional(string()),
  stage: string(),
  startsAt: optional(string()),
  durationMinutes: optional(number()),
  status: string(),
});

// 2. Inspection Results
export const inspectionResultsRecordSchema = object({
  teamNumber: string(),
  stage: string(),
  status: string(),
  recordedAt: string(),
  comment: optional(string()),
});

// 3. Match Schedule
export const matchScheduleRecordSchema = object({
  matchKey: string(),
  phase: picklist(["PRACTICE", "QUALIFICATION", "PLAYOFF"]),
  matchNumber: number(),
  playNumber: optional(number()),
  description: optional(string()),
  scheduledAt: optional(string()),
  status: string(),
  alliances: array(
    object({
      color: picklist(["RED", "BLUE"]),
      teamNumbers: array(string()),
    })
  ),
  externalScheduleDetailId: optional(string()),
});

// 4. Match Results
export const matchResultDetailsAllianceSchema = object({
  aSecondTierFlags: number(),
  aFirstTierFlags: number(),
  aCenterFlags: number(),
  bCenterFlagDown: number(),
  bBaseFlagsDown: number(),
  cOpponentBackfieldBullets: number(),
  dRobotParkState: number(),
  dGoldFlagsDefended: number(),
  scoreA: number(),
  scoreB: number(),
  scoreC: number(),
  scoreD: number(),
  scoreTotal: number(),
});

export const matchResultDetails2025Schema = object({
  redAlliance: matchResultDetailsAllianceSchema,
  blueAlliance: matchResultDetailsAllianceSchema,
});

export const matchResultsRecordSchema = object({
  matchKey: string(),
  phase: picklist(["PRACTICE", "QUALIFICATION", "PLAYOFF"]),
  status: string(),
  playedAt: optional(string()),
  redScore: number(),
  blueScore: number(),
  redPenalty: optional(number()),
  bluePenalty: optional(number()),
  winnerAlliance: optional(picklist(["RED", "BLUE", "TIE"])),
  alliances: array(
    object({
      color: picklist(["RED", "BLUE"]),
      teamNumbers: array(string()),
    })
  ),
  cards: optional(array(string())),
  disqualifications: optional(array(string())),
  noShows: optional(array(string())),
  externalMatchId: optional(string()),
  details: optional(matchResultDetails2025Schema),
});

// 5. Team Rankings
export const teamRankingsRecordSchema = object({
  teamNumber: string(),
  rank: number(),
  rankChange: optional(number()),
  wins: number(),
  losses: number(),
  ties: number(),
  matchesPlayed: number(),
  qualifyingScore: optional(number()),
  pointsScoredTotal: optional(number()),
  pointsScoredAverage: optional(number()),
  sortOrders: optional(array(number())),
  details: optional(object({})),
  modifiedAt: optional(string()),
});

// 6. Team Awards
export const teamAwardsRecordSchema = object({
  awardCode: string(),
  awardName: string(),
  displayOrder: optional(number()),
  teamNumber: optional(string()),
  recipient: optional(string()),
  isPublic: boolean(),
  comment: optional(string()),
  assignedAt: optional(string()),
});
