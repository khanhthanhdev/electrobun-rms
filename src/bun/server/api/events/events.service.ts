import { eq } from "drizzle-orm";
import { db, schema } from "../../../db";
import {
  type EventPrintListsResponse,
  getEventPrintLists,
} from "../../services/event-print-lists-service";
import type { ManualEventPayload } from "../../services/manual-event-service";
import {
  createManualEvent,
  getDefaultAccounts,
  regenerateEventDefaultAccounts,
} from "../../services/manual-event-service";
import type { UpdateEventBody } from "./events.schema";

export function listEvents() {
  return db.select().from(schema.events).all();
}

export function createEventFromManualPayload(payload: ManualEventPayload) {
  return createManualEvent(payload);
}

export function listDefaultEventAccounts(eventCode: string) {
  return getDefaultAccounts(eventCode);
}

export function regenerateDefaultEventAccounts(eventCode: string) {
  return regenerateEventDefaultAccounts(eventCode);
}

export function listEventPrintLists(
  eventCode: string
): EventPrintListsResponse {
  return getEventPrintLists(eventCode);
}

export function getEvent(eventCode: string) {
  const [event] = db
    .select()
    .from(schema.events)
    .where(eq(schema.events.code, eventCode))
    .limit(1)
    .all();
  return event ?? null;
}

export function updateEvent(eventCode: string, payload: UpdateEventBody) {
  const startTs = new Date(payload.startDate).getTime();
  const endTs = new Date(payload.endDate).getTime();

  if (Number.isNaN(startTs) || Number.isNaN(endTs)) {
    throw new Error("Invalid date format provided");
  }
  return db
    .update(schema.events)
    .set({
      name: payload.eventName,
      region: payload.region,
      type: payload.eventType,
      start: startTs,
      end: endTs,
      divisions: payload.divisions,
      finals: payload.finals ?? 0,
      status: payload.status ?? 0,
    })
    .where(eq(schema.events.code, eventCode))
    .returning()
    .get();
}
