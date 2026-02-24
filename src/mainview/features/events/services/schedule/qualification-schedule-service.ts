import {
  type PrintDestination,
  printTable,
} from "../../../../shared/services/print-service";
import {
  clearSchedule,
  fetchSchedule,
  generateSchedule,
  saveSchedule,
  setScheduleActivation,
} from "./schedule-service-core";
import type {
  OneVsOneScheduleMatch,
  ScheduleConfigBase,
} from "./shared-schedule-types";

export interface QualificationMetrics {
  averageSideImbalance: number;
  backToBackCount: number;
  maxOpponentRepeat: number;
  maxSideImbalance: number;
  repeatOpponentPairs: number;
  surrogateSlots: number;
}

export interface QualificationScheduleResponse {
  config: ScheduleConfigBase & {
    fieldStartOffsetSeconds: number;
    matchesPerTeam: number;
  };
  eventCode: string;
  isActive: boolean;
  matches: OneVsOneScheduleMatch[];
  metrics: QualificationMetrics;
}

export interface GenerateQualificationSchedulePayload {
  cycleTimeSeconds?: number;
  fieldCount?: number;
  fieldStartOffsetSeconds?: number;
  matchesPerTeam?: number;
  startTime?: number;
}

export interface SaveQualificationSchedulePayload {
  cycleTimeSeconds?: number;
  fieldCount?: number;
  fieldStartOffsetSeconds?: number;
  matches: Array<{
    blueSurrogate?: boolean;
    blueTeam: number;
    matchNumber: number;
    redSurrogate?: boolean;
    redTeam: number;
  }>;
  startTime: number;
}

export interface QualificationScheduleResultRow {
  blueSurrogate: boolean;
  blueTeam: number;
  fieldNumber: number;
  matchLabel: string;
  matchNumber: number;
  redSurrogate: boolean;
  redTeam: number;
  startTime: number;
}

interface PrintQualificationScheduleResultOptions {
  destination: PrintDestination;
  eventCode: string;
  generatedAt?: string;
  rows: QualificationScheduleResultRow[];
}

const formatTeamCell = (teamNumber: number, isSurrogate: boolean): string =>
  `${teamNumber}${isSurrogate ? "*" : ""}`;

const formatScheduleTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

export const printQualificationScheduleResults = ({
  destination,
  eventCode,
  generatedAt = new Date().toISOString(),
  rows,
}: PrintQualificationScheduleResultOptions): void => {
  printTable<QualificationScheduleResultRow>({
    destination,
    generatedAt,
    title: `${eventCode.toUpperCase()} Qualification Schedule`,
    subtitle: "Qualification match results",
    rows,
    emptyMessage: "No qualification matches available.",
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

export const fetchQualificationSchedule = (
  eventCode: string,
  token: string
): Promise<QualificationScheduleResponse> =>
  fetchSchedule<QualificationScheduleResponse>(eventCode, "quals", token);

export const generateQualificationSchedule = (
  eventCode: string,
  payload: GenerateQualificationSchedulePayload,
  token: string
): Promise<QualificationScheduleResponse> =>
  generateSchedule<
    QualificationScheduleResponse,
    GenerateQualificationSchedulePayload
  >(eventCode, "quals", payload, token);

export const saveQualificationSchedule = (
  eventCode: string,
  payload: SaveQualificationSchedulePayload,
  token: string
): Promise<QualificationScheduleResponse> =>
  saveSchedule<QualificationScheduleResponse, SaveQualificationSchedulePayload>(
    eventCode,
    "quals",
    payload,
    token
  );

export const clearQualificationSchedule = async (
  eventCode: string,
  token: string
): Promise<void> => {
  await clearSchedule(eventCode, "quals", token);
};

export const setQualificationScheduleActivation = (
  eventCode: string,
  active: boolean,
  token: string
): Promise<QualificationScheduleResponse> =>
  setScheduleActivation<QualificationScheduleResponse>(
    eventCode,
    "quals",
    active,
    token
  );
