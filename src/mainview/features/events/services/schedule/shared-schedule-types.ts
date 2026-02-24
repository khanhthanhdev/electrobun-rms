export interface OneVsOneScheduleMatch {
  blueSurrogate: boolean;
  blueTeam: number;
  blueTeamName?: string;
  endTime: number;
  matchNumber: number;
  redSurrogate: boolean;
  redTeam: number;
  redTeamName?: string;
  startTime: number;
}

export interface ScheduleConfigBase {
  cycleTimeSeconds: number;
  fieldCount: number;
  fieldStartOffsetSeconds?: number;
  matchTimeSeconds: number;
  startTime: number | null;
}
