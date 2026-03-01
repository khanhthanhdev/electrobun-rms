/**
 * Schedule subfeature public API.
 */

export {
  clearSchedule,
  fetchSchedule,
  generateSchedule,
  saveSchedule,
  setScheduleActivation,
} from "./api/schedule-service-core";
export type {
  GeneratePracticeSchedulePayload,
  PracticeScheduleResponse,
  PracticeScheduleResultRow,
  SavePracticeSchedulePayload,
} from "./practice-schedule-service";
export {
  clearPracticeSchedule,
  fetchPracticeSchedule,
  generatePracticeSchedule,
  printPracticeScheduleResults,
  savePracticeSchedule,
  setPracticeScheduleActivation,
} from "./practice-schedule-service";
export type {
  GenerateQualificationSchedulePayload,
  QualificationMetrics,
  QualificationScheduleResponse,
  QualificationScheduleResultRow,
  SaveQualificationSchedulePayload,
} from "./qualification-schedule-service";
export {
  clearQualificationSchedule,
  fetchQualificationSchedule,
  generateQualificationSchedule,
  printQualificationScheduleResults,
  saveQualificationSchedule,
  setQualificationScheduleActivation,
} from "./qualification-schedule-service";

export type {
  OneVsOneScheduleMatch,
  ScheduleConfigBase,
} from "./types/shared-schedule-types";
