import {
  type PrintDestination,
  printTable,
} from "@/shared/services/print-service";
import {
  clearSchedule,
  fetchSchedule,
  generateSchedule,
  saveSchedule,
  setScheduleActivation,
} from "./api/schedule-service-core";
import type {
  OneVsOneScheduleMatch,
  ScheduleConfigBase,
} from "./types/shared-schedule-types";

export interface PracticeScheduleResponse {
  config: ScheduleConfigBase;
  eventCode: string;
  isActive: boolean;
  matches: OneVsOneScheduleMatch[];
}

export interface SavePracticeSchedulePayload {
  cycleTimeSeconds?: number;
  matches: Array<{
    blueSurrogate?: boolean;
    blueTeam: number;
    matchNumber: number;
    redSurrogate?: boolean;
    redTeam: number;
  }>;
  startTime: number;
}

export interface GeneratePracticeSchedulePayload {
  fieldStartOffsetSeconds?: number;
  matchBlocks: Array<{
    cycleTimeSeconds: number;
    endTime: number;
    startTime: number;
  }>;
  matchesPerTeam: number;
}

export interface PracticeScheduleResultRow {
  blueSurrogate: boolean;
  blueTeam: number;
  fieldNumber: number;
  matchLabel: string;
  matchNumber: number;
  redSurrogate: boolean;
  redTeam: number;
  startTime: number;
}

interface PrintPracticeScheduleResultOptions {
  destination: PrintDestination;
  eventCode: string;
  generatedAt?: string;
  rows: PracticeScheduleResultRow[];
}

const formatTeamCell = (teamNumber: number, isSurrogate: boolean): string =>
  `${teamNumber}${isSurrogate ? "*" : ""}`;

const formatScheduleTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

export const printPracticeScheduleResults = ({
  destination,
  eventCode,
  generatedAt = new Date().toISOString(),
  rows,
}: PrintPracticeScheduleResultOptions): void => {
  printTable<PracticeScheduleResultRow>({
    destination,
    generatedAt,
    title: `${eventCode.toUpperCase()} Practice Schedule`,
    subtitle: "Practice match results",
    rows,
    emptyMessage: "No practice matches available.",
    columns: [
      {
        header: "Start",
        formatValue: (row) => formatScheduleTime(row.startTime),
      },
      {
        header: "Match",
        formatValue: (row) => row.matchLabel,
      },
      {
        header: "Field",
        formatValue: (row) => String(row.fieldNumber),
      },
      {
        header: "Red",
        formatValue: (row) => formatTeamCell(row.redTeam, row.redSurrogate),
      },
      {
        header: "Blue",
        formatValue: (row) => formatTeamCell(row.blueTeam, row.blueSurrogate),
      },
    ],
  });
};

export const fetchPracticeSchedule = (
  eventCode: string,
  token: string
): Promise<PracticeScheduleResponse> =>
  fetchSchedule<PracticeScheduleResponse>(eventCode, "practice", token);

export const savePracticeSchedule = (
  eventCode: string,
  payload: SavePracticeSchedulePayload,
  token: string
): Promise<PracticeScheduleResponse> =>
  saveSchedule<PracticeScheduleResponse, SavePracticeSchedulePayload>(
    eventCode,
    "practice",
    payload,
    token
  );

export const generatePracticeSchedule = (
  eventCode: string,
  payload: GeneratePracticeSchedulePayload,
  token: string
): Promise<PracticeScheduleResponse> =>
  generateSchedule<PracticeScheduleResponse, GeneratePracticeSchedulePayload>(
    eventCode,
    "practice",
    payload,
    token
  );

export const clearPracticeSchedule = async (
  eventCode: string,
  token: string
): Promise<void> => {
  await clearSchedule(eventCode, "practice", token);
};

export const setPracticeScheduleActivation = (
  eventCode: string,
  active: boolean,
  token: string
): Promise<PracticeScheduleResponse> =>
  setScheduleActivation<PracticeScheduleResponse>(
    eventCode,
    "practice",
    active,
    token
  );
