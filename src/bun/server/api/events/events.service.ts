import { db, schema } from "../../../db";
import type { ManualEventPayload } from "../../services/manual-event-service";
import {
  createManualEvent,
  getDefaultAccounts,
} from "../../services/manual-event-service";

export function listEvents() {
  return db.select().from(schema.events).all();
}

export function createEventFromManualPayload(payload: ManualEventPayload) {
  return createManualEvent(payload);
}

export function listDefaultEventAccounts(eventCode: string) {
  return getDefaultAccounts(eventCode);
}
