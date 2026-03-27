import type {
  PracticeSchedulePersistenceInput,
  PracticeScheduleSnapshot,
  QualificationSchedulePersistenceInput,
  QualificationScheduleSnapshot,
  ScheduleEventContext,
  ScheduleType,
} from "../../../application/dtos/schedule";
import type { ScheduleRepository } from "../../../application/interfaces/schedule-repository";
import {
  loadEventTeamNumbersFromEventDb,
  loadPracticeScheduleFromEventDb,
  loadQualificationScheduleFromEventDb,
} from "./sqlite-schedule-loaders";
import {
  clearPracticeScheduleInEventDb,
  clearQualificationScheduleInEventDb,
  replacePracticeScheduleInEventDb,
  replaceQualificationScheduleInEventDb,
  setScheduleActivationInEventDb,
} from "./sqlite-schedule-persistence";
import {
  assertEventExists,
  loadEventFieldCount,
  withEventDb,
} from "./sqlite-schedule-shared";

export class SQLiteScheduleRepository implements ScheduleRepository {
  loadEventContext(eventCode: string): Promise<ScheduleEventContext> {
    return Promise.resolve().then(() => {
      assertEventExists(eventCode);
      return {
        fieldCount: loadEventFieldCount(eventCode),
        teamNumbers: withEventDb(eventCode, loadEventTeamNumbersFromEventDb),
      };
    });
  }

  loadPracticeSchedule(eventCode: string): Promise<PracticeScheduleSnapshot> {
    return Promise.resolve().then(() => {
      assertEventExists(eventCode);
      const fieldCount = loadEventFieldCount(eventCode);
      return withEventDb(eventCode, (eventDb) =>
        loadPracticeScheduleFromEventDb(eventDb, fieldCount)
      );
    });
  }

  replacePracticeSchedule(
    eventCode: string,
    input: PracticeSchedulePersistenceInput
  ): Promise<void> {
    return Promise.resolve().then(() => {
      assertEventExists(eventCode);
      withEventDb(eventCode, (eventDb) =>
        replacePracticeScheduleInEventDb(eventDb, input)
      );
    });
  }

  clearPracticeSchedule(eventCode: string): Promise<void> {
    return Promise.resolve().then(() => {
      assertEventExists(eventCode);
      withEventDb(eventCode, clearPracticeScheduleInEventDb);
    });
  }

  loadQualificationSchedule(
    eventCode: string
  ): Promise<QualificationScheduleSnapshot> {
    return Promise.resolve().then(() => {
      assertEventExists(eventCode);
      const fieldCount = loadEventFieldCount(eventCode);
      return withEventDb(eventCode, (eventDb) =>
        loadQualificationScheduleFromEventDb(eventDb, fieldCount)
      );
    });
  }

  replaceQualificationSchedule(
    eventCode: string,
    input: QualificationSchedulePersistenceInput
  ): Promise<void> {
    return Promise.resolve().then(() => {
      assertEventExists(eventCode);
      withEventDb(eventCode, (eventDb) =>
        replaceQualificationScheduleInEventDb(eventDb, input)
      );
    });
  }

  clearQualificationSchedule(eventCode: string): Promise<void> {
    return Promise.resolve().then(() => {
      assertEventExists(eventCode);
      withEventDb(eventCode, clearQualificationScheduleInEventDb);
    });
  }

  setScheduleActivation(
    eventCode: string,
    scheduleType: ScheduleType,
    active: boolean
  ): Promise<void> {
    return Promise.resolve().then(() => {
      assertEventExists(eventCode);
      withEventDb(eventCode, (eventDb) =>
        setScheduleActivationInEventDb(eventDb, scheduleType, active)
      );
    });
  }
}
