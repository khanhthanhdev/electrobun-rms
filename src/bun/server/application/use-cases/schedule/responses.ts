import type {
  PracticeScheduleResponse,
  PracticeScheduleSnapshot,
  QualificationScheduleResponse,
  QualificationScheduleSnapshot,
} from "../../dtos/schedule";
import {
  computeQualificationMetrics,
  EMPTY_QUALIFICATION_METRICS,
} from "./qualification-generation";
import { DEFAULT_MATCH_TIME_SECONDS } from "./shared";

export const toPracticeScheduleResponse = (
  eventCode: string,
  snapshot: PracticeScheduleSnapshot
): PracticeScheduleResponse => ({
  eventCode,
  isActive: snapshot.isActive,
  matches: snapshot.matches,
  config: {
    ...snapshot.config,
    matchTimeSeconds: DEFAULT_MATCH_TIME_SECONDS,
  },
});

export const toQualificationScheduleResponse = (
  eventCode: string,
  snapshot: QualificationScheduleSnapshot
): QualificationScheduleResponse => ({
  eventCode,
  isActive: snapshot.isActive,
  matches: snapshot.matches,
  metrics:
    snapshot.matches.length > 0
      ? computeQualificationMetrics(snapshot.matches)
      : EMPTY_QUALIFICATION_METRICS,
  config: {
    ...snapshot.config,
    matchTimeSeconds: DEFAULT_MATCH_TIME_SECONDS,
  },
});
