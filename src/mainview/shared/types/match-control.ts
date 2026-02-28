export type ControlMatchType = "practice" | "quals";

export type ControlMatchState = "COMMITTED" | "INCOMPLETE" | "UNPLAYED";

export interface ControlMatchRow {
  blueScore: number | null;
  blueSurrogate: boolean;
  blueTeam: number;
  blueTeamName: string;
  fieldNumber: number;
  matchName: string;
  matchNumber: number;
  matchType: ControlMatchType;
  redScore: number | null;
  redSurrogate: boolean;
  redTeam: number;
  redTeamName: string;
  roundNumber: number;
  startTime: number;
  state: ControlMatchState;
}

export interface MatchControlData {
  activeScheduleType: ControlMatchType | null;
  availableMatchTypes: ControlMatchType[];
  byType: Record<ControlMatchType, ControlMatchRow[]>;
  warnings: string[];
}
