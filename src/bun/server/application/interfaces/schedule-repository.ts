import type {
  PracticeSchedulePersistenceInput,
  PracticeScheduleSnapshot,
  QualificationSchedulePersistenceInput,
  QualificationScheduleSnapshot,
  ScheduleEventContext,
  ScheduleType,
} from "../dtos/schedule";

export interface ScheduleRepository {
  clearPracticeSchedule(eventCode: string): Promise<void>;

  clearQualificationSchedule(eventCode: string): Promise<void>;
  loadEventContext(eventCode: string): Promise<ScheduleEventContext>;

  loadPracticeSchedule(eventCode: string): Promise<PracticeScheduleSnapshot>;

  loadQualificationSchedule(
    eventCode: string
  ): Promise<QualificationScheduleSnapshot>;

  replacePracticeSchedule(
    eventCode: string,
    input: PracticeSchedulePersistenceInput
  ): Promise<void>;

  replaceQualificationSchedule(
    eventCode: string,
    input: QualificationSchedulePersistenceInput
  ): Promise<void>;

  setScheduleActivation(
    eventCode: string,
    scheduleType: ScheduleType,
    active: boolean
  ): Promise<void>;
}
