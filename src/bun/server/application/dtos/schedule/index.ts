export type ScheduleType = "practice" | "quals";

export interface OneVsOneScheduleMatch {
  blueSurrogate: boolean;
  blueTeam: number;
  endTime: number;
  matchNumber: number;
  redSurrogate: boolean;
  redTeam: number;
  startTime: number;
}

export interface SaveOneVsOneScheduleMatchInput {
  blueSurrogate?: boolean;
  blueTeam: number;
  matchNumber: number;
  redSurrogate?: boolean;
  redTeam: number;
}

export interface MatchBlockInput {
  cycleTimeSeconds: number;
  endTime: number;
  startTime: number;
}

export interface PracticeScheduleConfig {
  cycleTimeSeconds: number;
  fieldCount: number;
  fieldStartOffsetSeconds: number;
  matchTimeSeconds: number;
  startTime: number | null;
}

export interface PracticeScheduleSnapshot {
  config: Omit<PracticeScheduleConfig, "matchTimeSeconds">;
  isActive: boolean;
  matches: OneVsOneScheduleMatch[];
}

export interface PracticeScheduleResponse {
  config: PracticeScheduleConfig;
  eventCode: string;
  isActive: boolean;
  matches: OneVsOneScheduleMatch[];
}

export interface SavePracticeScheduleInput {
  cycleTimeSeconds?: number;
  matches: SaveOneVsOneScheduleMatchInput[];
  startTime: number;
}

export interface GeneratePracticeScheduleInput {
  fieldStartOffsetSeconds?: number;
  matchBlocks: MatchBlockInput[];
  matchesPerTeam: number;
}

export interface PracticeSchedulePersistenceInput {
  blocks: MatchBlockInput[];
  matches: OneVsOneScheduleMatch[];
  window: {
    endTime: number;
    startTime: number;
  };
}

export interface QualificationMetrics {
  averageSideImbalance: number;
  backToBackCount: number;
  maxOpponentRepeat: number;
  maxSideImbalance: number;
  repeatOpponentPairs: number;
  surrogateSlots: number;
}

export interface QualificationScheduleConfig {
  cycleTimeSeconds: number;
  fieldCount: number;
  fieldStartOffsetSeconds: number;
  matchesPerTeam: number;
  matchTimeSeconds: number;
  startTime: number | null;
}

export interface QualificationScheduleSnapshot {
  config: Omit<QualificationScheduleConfig, "matchTimeSeconds">;
  isActive: boolean;
  matches: OneVsOneScheduleMatch[];
}

export interface QualificationScheduleResponse {
  config: QualificationScheduleConfig;
  eventCode: string;
  isActive: boolean;
  matches: OneVsOneScheduleMatch[];
  metrics: QualificationMetrics;
}

export interface GenerateQualificationScheduleInput {
  cycleTimeSeconds?: number;
  fieldCount?: number;
  fieldStartOffsetSeconds?: number;
  matchesPerTeam?: number;
  startTime?: number;
}

export interface SaveQualificationScheduleInput {
  cycleTimeSeconds?: number;
  fieldCount?: number;
  fieldStartOffsetSeconds?: number;
  matches: SaveOneVsOneScheduleMatchInput[];
  startTime: number;
}

export interface QualificationSchedulePersistenceInput {
  cycleTimeSeconds: number;
  fieldCount: number;
  fieldStartOffsetSeconds: number;
  matches: OneVsOneScheduleMatch[];
  matchesPerTeam: number;
  startTime: number;
}

export interface ScheduleEventContext {
  fieldCount: number;
  teamNumbers: number[];
}
