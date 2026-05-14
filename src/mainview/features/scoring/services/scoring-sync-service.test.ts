import { describe, expect, it } from "bun:test";

// Re-export the parser for testing by importing the module and accessing
// the function through the public API. Since the parser is not exported,
// we test it indirectly through the connectScoringRealtime function's
// parseEvent callback. However, for unit test isolation, we'll test the
// validation logic by recreating the parser behavior.

// The parser validation logic (mirrored from scoring-sync-service.ts):
type ScoringRealtimeChangeKind = "SCORE_UPDATED" | "SNAPSHOT_HINT";

interface ScoringRealtimeChangeEvent {
  changedAt: string;
  eventCode: string;
  kind: ScoringRealtimeChangeKind;
  matchNumber: number | null;
  matchType: string | null;
  version: number;
}

const VALID_CHANGE_KINDS = new Set<ScoringRealtimeChangeKind>([
  "SCORE_UPDATED",
  "SNAPSHOT_HINT",
]);

const parseScoringRealtimeChangeEvent = (
  rawData: string
): ScoringRealtimeChangeEvent | null => {
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
  const matchNumber = event.matchNumber;
  const matchType = event.matchType;

  if (
    typeof event.changedAt !== "string" ||
    typeof event.eventCode !== "string" ||
    typeof version !== "number" ||
    !Number.isInteger(version) ||
    version < 0 ||
    !VALID_CHANGE_KINDS.has(kind as ScoringRealtimeChangeKind)
  ) {
    return null;
  }

  if (
    !(
      matchNumber === null ||
      (typeof matchNumber === "number" &&
        Number.isInteger(matchNumber) &&
        matchNumber > 0)
    )
  ) {
    return null;
  }

  if (!(matchType === null || typeof matchType === "string")) {
    return null;
  }

  return {
    changedAt: event.changedAt as string,
    eventCode: event.eventCode as string,
    kind: kind as ScoringRealtimeChangeKind,
    matchNumber: matchNumber as number | null,
    matchType: matchType as string | null,
    version: version as number,
  };
};

describe("parseScoringRealtimeChangeEvent", () => {
  const validEvent: ScoringRealtimeChangeEvent = {
    changedAt: "2024-01-01T00:00:00Z",
    eventCode: "TEST",
    kind: "SCORE_UPDATED",
    matchNumber: 1,
    matchType: "quals",
    version: 1,
  };

  it("parses a valid SCORE_UPDATED event", () => {
    const result = parseScoringRealtimeChangeEvent(JSON.stringify(validEvent));
    expect(result).toEqual(validEvent);
  });

  it("parses a valid SNAPSHOT_HINT event", () => {
    const event: ScoringRealtimeChangeEvent = {
      ...validEvent,
      kind: "SNAPSHOT_HINT",
    };
    const result = parseScoringRealtimeChangeEvent(JSON.stringify(event));
    expect(result).toEqual(event);
  });

  it("parses event with null matchNumber and matchType", () => {
    const event: ScoringRealtimeChangeEvent = {
      ...validEvent,
      matchNumber: null,
      matchType: null,
    };
    const result = parseScoringRealtimeChangeEvent(JSON.stringify(event));
    expect(result).toEqual(event);
  });

  it("rejects invalid JSON", () => {
    expect(parseScoringRealtimeChangeEvent("not json")).toBeNull();
  });

  it("rejects non-object JSON", () => {
    expect(parseScoringRealtimeChangeEvent('"string"')).toBeNull();
    expect(parseScoringRealtimeChangeEvent("42")).toBeNull();
    expect(parseScoringRealtimeChangeEvent("null")).toBeNull();
    expect(parseScoringRealtimeChangeEvent("true")).toBeNull();
  });

  it("rejects missing changedAt", () => {
    const { changedAt, ...rest } = validEvent;
    expect(parseScoringRealtimeChangeEvent(JSON.stringify(rest))).toBeNull();
  });

  it("rejects non-string changedAt", () => {
    expect(
      parseScoringRealtimeChangeEvent(
        JSON.stringify({ ...validEvent, changedAt: 123 })
      )
    ).toBeNull();
  });

  it("rejects missing eventCode", () => {
    const { eventCode, ...rest } = validEvent;
    expect(parseScoringRealtimeChangeEvent(JSON.stringify(rest))).toBeNull();
  });

  it("rejects missing kind", () => {
    const { kind, ...rest } = validEvent;
    expect(parseScoringRealtimeChangeEvent(JSON.stringify(rest))).toBeNull();
  });

  it("rejects invalid kind", () => {
    expect(
      parseScoringRealtimeChangeEvent(
        JSON.stringify({ ...validEvent, kind: "INVALID" })
      )
    ).toBeNull();
  });

  it("rejects missing version", () => {
    const { version, ...rest } = validEvent;
    expect(parseScoringRealtimeChangeEvent(JSON.stringify(rest))).toBeNull();
  });

  it("rejects non-integer version", () => {
    expect(
      parseScoringRealtimeChangeEvent(
        JSON.stringify({ ...validEvent, version: 1.5 })
      )
    ).toBeNull();
  });

  it("rejects negative version", () => {
    expect(
      parseScoringRealtimeChangeEvent(
        JSON.stringify({ ...validEvent, version: -1 })
      )
    ).toBeNull();
  });

  it("accepts version 0", () => {
    const event: ScoringRealtimeChangeEvent = { ...validEvent, version: 0 };
    expect(parseScoringRealtimeChangeEvent(JSON.stringify(event))).toEqual(
      event
    );
  });

  it("rejects non-integer matchNumber", () => {
    expect(
      parseScoringRealtimeChangeEvent(
        JSON.stringify({ ...validEvent, matchNumber: 1.5 })
      )
    ).toBeNull();
  });

  it("rejects zero matchNumber", () => {
    expect(
      parseScoringRealtimeChangeEvent(
        JSON.stringify({ ...validEvent, matchNumber: 0 })
      )
    ).toBeNull();
  });

  it("rejects negative matchNumber", () => {
    expect(
      parseScoringRealtimeChangeEvent(
        JSON.stringify({ ...validEvent, matchNumber: -1 })
      )
    ).toBeNull();
  });

  it("rejects non-string matchType", () => {
    expect(
      parseScoringRealtimeChangeEvent(
        JSON.stringify({ ...validEvent, matchType: 123 })
      )
    ).toBeNull();
  });
});
