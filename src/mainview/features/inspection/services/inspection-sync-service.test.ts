import { describe, expect, it } from "bun:test";

// Test the inspection realtime parser validation logic (mirrored from inspection-sync-service.ts)
type InspectionRealtimeChangeKind =
  | "ITEMS_UPDATED"
  | "STATUS_UPDATED"
  | "COMMENT_UPDATED"
  | "OVERRIDE_APPLIED"
  | "SNAPSHOT_HINT";

interface InspectionRealtimeChangeEvent {
  changedAt: string;
  eventCode: string;
  kind: InspectionRealtimeChangeKind;
  teamNumber: number | null;
  version: number;
}

const VALID_CHANGE_KINDS = new Set<InspectionRealtimeChangeKind>([
  "ITEMS_UPDATED",
  "STATUS_UPDATED",
  "COMMENT_UPDATED",
  "OVERRIDE_APPLIED",
  "SNAPSHOT_HINT",
]);

const parseInspectionRealtimeChangeEvent = (
  rawData: string
): InspectionRealtimeChangeEvent | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const event = parsed as Record<string, unknown>;
  const kind = event.kind;
  const version = event.version;
  const teamNumber = event.teamNumber;

  if (
    typeof event.changedAt !== "string" ||
    typeof event.eventCode !== "string" ||
    typeof version !== "number" ||
    !Number.isInteger(version) ||
    version < 0 ||
    !VALID_CHANGE_KINDS.has(kind as InspectionRealtimeChangeKind)
  ) {
    return null;
  }

  if (
    !(
      teamNumber === null ||
      (typeof teamNumber === "number" &&
        Number.isInteger(teamNumber) &&
        teamNumber > 0)
    )
  ) {
    return null;
  }

  return {
    changedAt: event.changedAt as string,
    eventCode: event.eventCode as string,
    kind: kind as InspectionRealtimeChangeKind,
    teamNumber: teamNumber as number | null,
    version: version as number,
  };
};

describe("parseInspectionRealtimeChangeEvent", () => {
  const validEvent: InspectionRealtimeChangeEvent = {
    changedAt: "2024-01-01T00:00:00Z",
    eventCode: "TEST",
    kind: "ITEMS_UPDATED",
    teamNumber: 42,
    version: 1,
  };

  it("parses a valid ITEMS_UPDATED event", () => {
    const result = parseInspectionRealtimeChangeEvent(
      JSON.stringify(validEvent)
    );
    expect(result).toEqual(validEvent);
  });

  it.each([
    "STATUS_UPDATED",
    "COMMENT_UPDATED",
    "OVERRIDE_APPLIED",
    "SNAPSHOT_HINT",
  ] as const)("parses a valid %s event", (kind) => {
    const event: InspectionRealtimeChangeEvent = { ...validEvent, kind };
    const result = parseInspectionRealtimeChangeEvent(JSON.stringify(event));
    expect(result).toEqual(event);
  });

  it("parses event with null teamNumber", () => {
    const event: InspectionRealtimeChangeEvent = {
      ...validEvent,
      teamNumber: null,
    };
    const result = parseInspectionRealtimeChangeEvent(JSON.stringify(event));
    expect(result).toEqual(event);
  });

  it("rejects invalid JSON", () => {
    expect(parseInspectionRealtimeChangeEvent("not json")).toBeNull();
  });

  it("rejects non-object JSON", () => {
    expect(parseInspectionRealtimeChangeEvent('"string"')).toBeNull();
    expect(parseInspectionRealtimeChangeEvent("42")).toBeNull();
    expect(parseInspectionRealtimeChangeEvent("null")).toBeNull();
    expect(parseInspectionRealtimeChangeEvent("true")).toBeNull();
  });

  it("rejects missing changedAt", () => {
    const { changedAt, ...rest } = validEvent;
    expect(parseInspectionRealtimeChangeEvent(JSON.stringify(rest))).toBeNull();
  });

  it("rejects non-string changedAt", () => {
    expect(
      parseInspectionRealtimeChangeEvent(
        JSON.stringify({ ...validEvent, changedAt: 123 })
      )
    ).toBeNull();
  });

  it("rejects missing eventCode", () => {
    const { eventCode, ...rest } = validEvent;
    expect(parseInspectionRealtimeChangeEvent(JSON.stringify(rest))).toBeNull();
  });

  it("rejects missing kind", () => {
    const { kind, ...rest } = validEvent;
    expect(parseInspectionRealtimeChangeEvent(JSON.stringify(rest))).toBeNull();
  });

  it("rejects invalid kind", () => {
    expect(
      parseInspectionRealtimeChangeEvent(
        JSON.stringify({ ...validEvent, kind: "INVALID" })
      )
    ).toBeNull();
  });

  it("rejects missing version", () => {
    const { version, ...rest } = validEvent;
    expect(parseInspectionRealtimeChangeEvent(JSON.stringify(rest))).toBeNull();
  });

  it("rejects non-integer version", () => {
    expect(
      parseInspectionRealtimeChangeEvent(
        JSON.stringify({ ...validEvent, version: 1.5 })
      )
    ).toBeNull();
  });

  it("rejects negative version", () => {
    expect(
      parseInspectionRealtimeChangeEvent(
        JSON.stringify({ ...validEvent, version: -1 })
      )
    ).toBeNull();
  });

  it("accepts version 0", () => {
    const event: InspectionRealtimeChangeEvent = {
      ...validEvent,
      version: 0,
    };
    expect(parseInspectionRealtimeChangeEvent(JSON.stringify(event))).toEqual(
      event
    );
  });

  it("rejects non-integer teamNumber", () => {
    expect(
      parseInspectionRealtimeChangeEvent(
        JSON.stringify({ ...validEvent, teamNumber: 1.5 })
      )
    ).toBeNull();
  });

  it("rejects zero teamNumber", () => {
    expect(
      parseInspectionRealtimeChangeEvent(
        JSON.stringify({ ...validEvent, teamNumber: 0 })
      )
    ).toBeNull();
  });

  it("rejects negative teamNumber", () => {
    expect(
      parseInspectionRealtimeChangeEvent(
        JSON.stringify({ ...validEvent, teamNumber: -1 })
      )
    ).toBeNull();
  });

  it("rejects non-number teamNumber", () => {
    expect(
      parseInspectionRealtimeChangeEvent(
        JSON.stringify({ ...validEvent, teamNumber: "42" })
      )
    ).toBeNull();
  });
});
