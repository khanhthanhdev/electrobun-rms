import type {
  GeneratePracticeScheduleInput,
  GenerateQualificationScheduleInput,
  PracticeScheduleResponse,
  QualificationScheduleResponse,
  SavePracticeScheduleInput,
  SaveQualificationScheduleInput,
} from "../../services/event-schedule-service";
import {
  clearPracticeSchedule,
  clearQualificationSchedule,
  generatePracticeSchedule,
  generateQualificationSchedule,
  getPracticeSchedule,
  getQualificationSchedule,
  savePracticeSchedule,
  saveQualificationSchedule,
  setPracticeScheduleActive,
  setQualificationScheduleActive,
} from "../../services/event-schedule-service";

export function listPracticeSchedule(
  eventCode: string
): PracticeScheduleResponse {
  return getPracticeSchedule(eventCode);
}

export function editPracticeSchedule(
  eventCode: string,
  payload: SavePracticeScheduleInput
): PracticeScheduleResponse {
  return savePracticeSchedule(eventCode, payload);
}

export function regeneratePracticeSchedule(
  eventCode: string,
  payload: GeneratePracticeScheduleInput
): PracticeScheduleResponse {
  return generatePracticeSchedule(eventCode, payload);
}

export function deletePracticeSchedule(
  eventCode: string
): PracticeScheduleResponse {
  return clearPracticeSchedule(eventCode);
}

export function updatePracticeScheduleActivation(
  eventCode: string,
  active: boolean
): PracticeScheduleResponse {
  return setPracticeScheduleActive(eventCode, active);
}

export function listQualificationSchedule(
  eventCode: string
): QualificationScheduleResponse {
  return getQualificationSchedule(eventCode);
}

export function regenerateQualificationSchedule(
  eventCode: string,
  payload: GenerateQualificationScheduleInput
): QualificationScheduleResponse {
  return generateQualificationSchedule(eventCode, payload);
}

export function editQualificationSchedule(
  eventCode: string,
  payload: SaveQualificationScheduleInput
): QualificationScheduleResponse {
  return saveQualificationSchedule(eventCode, payload);
}

export function deleteQualificationSchedule(
  eventCode: string
): QualificationScheduleResponse {
  return clearQualificationSchedule(eventCode);
}

export function updateQualificationScheduleActivation(
  eventCode: string,
  active: boolean
): QualificationScheduleResponse {
  return setQualificationScheduleActive(eventCode, active);
}
