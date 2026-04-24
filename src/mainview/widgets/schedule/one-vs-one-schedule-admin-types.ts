export type ScheduleMessageSetter = (message: string | null) => void;
export type TeamNamesByNumber = Record<number, string>;

export interface OneVsOneEditableMatch {
  blueSurrogate?: boolean;
  blueTeam: number;
  blueTeamName?: string;
  matchNumber: number;
  redSurrogate?: boolean;
  redTeam: number;
  redTeamName?: string;
}

export interface OneVsOneSaveMatch {
  blueSurrogate?: boolean;
  blueTeam: number;
  matchNumber: number;
  redSurrogate?: boolean;
  redTeam: number;
}
