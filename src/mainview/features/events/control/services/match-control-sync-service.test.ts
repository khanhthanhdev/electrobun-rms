import { describe, expect, it } from "bun:test";

// Test the match-control realtime parser validation logic (mirrored from match-control-sync-service.ts)
type MatchControlSyncEventKind = "STATE_CHANGED" | "SNAPSHOT_HINT";

interface MatchControlState {
  eventCode: string;
  version: number;
  [key: string]: unknown;
}

interface MatchControlRealtimeChangeEvent {
  eventCode: string;
  kind: MatchControlSyncEventKind;
  state: MatchControlState | null;
  version: number;
}

const VALID_KINDS = new Set<MatchControlSyncEventKind>([
  "STATE_CHANGED",
  "SNAPSHOT_HINT",
]);

const parseMatchControlState = (value: unknown): MatchControlState | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const s = value as Record<string, unknown>;
  if (typeof s.eventCode !== "string" || typeof s.version !== "number") {
    return null;
  }
  return value as MatchControlState;
};

const parseMatchControlRealtimeEvent = (
  rawData: string
): MatchControlRealtimeChangeEvent | null => {
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

  if (
    typeof event.eventCode !== "string" ||
    typeof version !== "number" ||
    !Number.isInteger(version) ||
    version < 0 ||
    !VALID_KINDS.has(kind as MatchControlSyncEventKind)
  ) {
    return null;
  }

  return {
    eventCode: event.eventCode as string,
    kind: kind as MatchControlSyncEventKind,
    state: parseMatchControlState(event.state),
    version: version as number,
  };
};

describe("parseMatchControlRealtimeEvent", () => {
  const validState: MatchControlState = {
    eventCode: "TEST",
    version: 1,
    activeState: "IDLE",
    loadedState: "EMPTY",
  };

  const validEvent: MatchControlRealtimeChangeEvent = {
    eventCode: "TEST",
    kind: "STATE_CHANGED",
    state: validState,
    version: 1,
  };

  it("parses a valid STATE_CHANGED event", () => {
    const result = parseMatchControlRealtimeEvent(JSON.stringify(validEvent));
    expect(result).toEqual(validEvent);
  });

  it("parses a valid SNAPSHOT_HINT event", () => {
    const event: MatchControlRealtimeChangeEvent = {
      ...validEvent,
      kind: "SNAPSHOT_HINT",
    };
    const result = parseMatchControlRealtimeEvent(JSON.stringify(event));
    expect(result).toEqual(event);
  });

  it("parses event with null state", () => {
    const event: MatchControlRealtimeChangeEvent = {
      ...validEvent,
      state: null,
    };
    const result = parseMatchControlRealtimeEvent(JSON.stringify(event));
    expect(result).toEqual(event);
  });

  it("rejects invalid JSON", () => {
    expect(parseMatchControlRealtimeEvent("not json")).toBeNull();
  });

  it("rejects non-object JSON", () => {
    expect(parseMatchControlRealtimeEvent('"string"')).toBeNull();
    expect(parseMatchControlRealtimeEvent("42")).toBeNull();
    expect(parseMatchControlRealtimeEvent("null")).toBeNull();
    expect(parseMatchControlRealtimeEvent("true")).toBeNull();
  });

  it("rejects missing eventCode", () => {
    const { eventCode, ...rest } = validEvent;
    expect(parseMatchControlRealtimeEvent(JSON.stringify(rest))).toBeNull();
  });

  it("rejects non-string eventCode", () => {
    expect(
      parseMatchControlRealtimeEvent(
        JSON.stringify({ ...validEvent, eventCode: 123 })
      )
    ).toBeNull();
  });

  it("rejects missing kind", () => {
    const { kind, ...rest } = validEvent;
    expect(parseMatchControlRealtimeEvent(JSON.stringify(rest))).toBeNull();
  });

  it("rejects invalid kind", () => {
    expect(
      parseMatchControlRealtimeEvent(
        JSON.stringify({ ...validEvent, kind: "INVALID" })
      )
    ).toBeNull();
  });

  it("rejects missing version", () => {
    const { version, ...rest } = validEvent;
    expect(parseMatchControlRealtimeEvent(JSON.stringify(rest))).toBeNull();
  });

  it("rejects non-integer version", () => {
    expect(
      parseMatchControlRealtimeEvent(
        JSON.stringify({ ...validEvent, version: 1.5 })
      )
    ).toBeNull();
  });

  it("rejects negative version", () => {
    expect(
      parseMatchControlRealtimeEvent(
        JSON.stringify({ ...validEvent, version: -1 })
      )
    ).toBeNull();
  });

  it("accepts version 0", () => {
    const event: MatchControlRealtimeChangeEvent = {
      ...validEvent,
      version: 0,
    };
    expect(parseMatchControlRealtimeEvent(JSON.stringify(event))).toEqual(
      event
    );
  });
});

describe("parseMatchControlState", () => {
  it("parses a valid state object", () => {
    const state = { eventCode: "TEST", version: 1, activeState: "IDLE" };
    expect(parseMatchControlState(state)).toEqual(state);
  });

  it("rejects non-object values", () => {
    expect(parseMatchControlState(null)).toBeNull();
    expect(parseMatchControlState("string")).toBeNull();
    expect(parseMatchControlState(42)).toBeNull();
    expect(parseMatchControlState(true)).toBeNull();
  });

  it("rejects missing eventCode", () => {
    expect(parseMatchControlState({ version: 1 })).toBeNull();
  });

  it("rejects non-string eventCode", () => {
    expect(parseMatchControlState({ eventCode: 123, version: 1 })).toBeNull();
  });

  it("rejects missing version", () => {
    expect(parseMatchControlState({ eventCode: "TEST" })).toBeNull();
  });

  it("rejects non-number version", () => {
    expect(
      parseMatchControlState({ eventCode: "TEST", version: "1" })
    ).toBeNull();
  });

  it("accepts state with extra fields", () => {
    const state = {
      eventCode: "TEST",
      version: 1,
      activeState: "IDLE",
      loadedState: "EMPTY",
      activeMatch: null,
    };
    expect(parseMatchControlState(state)).toEqual(state);
  });
});
