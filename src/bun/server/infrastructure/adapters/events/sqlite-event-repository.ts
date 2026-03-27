import { eq } from "drizzle-orm";
import { db, schema } from "../../../../db";
import type {
  EventItem,
  UpdateEventInput,
} from "../../../application/dtos/events";
import type { EventRepository } from "../../../application/interfaces/event-repository";

const parseEventDateRange = (
  input: UpdateEventInput
): { endTs: number; startTs: number } => {
  const startTs = new Date(input.startDate).getTime();
  const endTs = new Date(input.endDate).getTime();

  if (Number.isNaN(startTs) || Number.isNaN(endTs)) {
    throw new Error("Invalid date format provided");
  }

  return { startTs, endTs };
};

export class SQLiteEventRepository implements EventRepository {
  listEvents(): Promise<EventItem[]> {
    return Promise.resolve().then(() => db.select().from(schema.events).all());
  }

  getEvent(eventCode: string): Promise<EventItem | null> {
    return Promise.resolve().then(() => {
      const [event] = db
        .select()
        .from(schema.events)
        .where(eq(schema.events.code, eventCode))
        .limit(1)
        .all();

      return event ?? null;
    });
  }

  updateEvent(
    eventCode: string,
    input: UpdateEventInput
  ): Promise<EventItem | null> {
    return Promise.resolve().then(() => {
      const { startTs, endTs } = parseEventDateRange(input);

      const event = db
        .update(schema.events)
        .set({
          name: input.eventName,
          region: input.region,
          type: input.eventType,
          start: startTs,
          end: endTs,
          divisions: input.divisions,
          fields: input.fields ?? 1,
          finals: input.finals ?? 0,
          status: input.status ?? 0,
        })
        .where(eq(schema.events.code, eventCode))
        .returning()
        .get();

      return event ?? null;
    });
  }
}
