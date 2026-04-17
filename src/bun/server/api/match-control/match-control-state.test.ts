import { describe, expect, it } from "bun:test";
import type { DisplayMatchRef } from "@shared/display";
import { applyTransition } from "./match-control-state";

const createMatchRef = (matchNumber: number): DisplayMatchRef => ({
  matchNumber,
  matchType: "quals",
  matchName: `Q${matchNumber}`,
  fieldNumber: 1,
  redTeam: 100 + matchNumber,
  redTeamName: `Red ${matchNumber}`,
  blueTeam: 200 + matchNumber,
  blueTeamName: `Blue ${matchNumber}`,
});

const nextEventCode = (suffix: string): string =>
  `TEST_MATCH_CONTROL_${suffix}_${Math.random().toString(36).slice(2, 8)}`;

describe("match control state transitions", () => {
  it("allows LOAD from PREVIEW state and resets loaded state to LOADED", () => {
    const eventCode = nextEventCode("load_preview_allowed");

    const load = applyTransition(
      eventCode,
      { type: "LOAD", expectedVersion: 0, match: createMatchRef(1) },
      0
    );
    expect("state" in load).toBe(true);

    const preview = applyTransition(
      eventCode,
      { type: "SHOW_PREVIEW", expectedVersion: 0 },
      0
    );
    expect("state" in preview).toBe(true);

    const loadAgain = applyTransition(
      eventCode,
      { type: "LOAD", expectedVersion: 0, match: createMatchRef(2) },
      0
    );
    expect("state" in loadAgain).toBe(true);
    if ("state" in loadAgain) {
      expect(loadAgain.state.loadedState).toBe("LOADED");
      expect(loadAgain.state.loadedMatch?.matchNumber).toBe(2);
    }
  });

  it("allows LOAD from READY state and replaces staged match", () => {
    const eventCode = nextEventCode("load_ready_allowed");

    const load = applyTransition(
      eventCode,
      { type: "LOAD", expectedVersion: 0, match: createMatchRef(1) },
      0
    );
    expect("state" in load).toBe(true);

    const preview = applyTransition(
      eventCode,
      { type: "SHOW_PREVIEW", expectedVersion: 0 },
      0
    );
    expect("state" in preview).toBe(true);

    const ready = applyTransition(
      eventCode,
      { type: "SHOW_MATCH", expectedVersion: 0 },
      0
    );
    expect("state" in ready).toBe(true);

    const loadAgain = applyTransition(
      eventCode,
      { type: "LOAD", expectedVersion: 0, match: createMatchRef(2) },
      0
    );
    expect("state" in loadAgain).toBe(true);
    if ("state" in loadAgain) {
      expect(loadAgain.state.loadedState).toBe("LOADED");
      expect(loadAgain.state.loadedMatch?.matchNumber).toBe(2);
    }
  });

  it("unloads a staged match and resets loaded slot to IDLE", () => {
    const eventCode = nextEventCode("unload");

    const load = applyTransition(
      eventCode,
      { type: "LOAD", expectedVersion: 0, match: createMatchRef(1) },
      0
    );
    expect("state" in load).toBe(true);

    const unload = applyTransition(
      eventCode,
      { type: "UNLOAD", expectedVersion: 0 },
      0
    );
    expect("state" in unload).toBe(true);
    if ("state" in unload) {
      expect(unload.state.loadedState).toBe("IDLE");
      expect(unload.state.loadedMatch).toBeNull();
      expect(unload.state.activeState).toBe("IDLE");
      expect(unload.state.activeMatch).toBeNull();
    }
  });

  it("rejects UNLOAD when loaded slot is already IDLE", () => {
    const eventCode = nextEventCode("unload_idle");

    const unload = applyTransition(
      eventCode,
      { type: "UNLOAD", expectedVersion: 0 },
      0
    );

    expect("error" in unload).toBe(true);
    if ("error" in unload) {
      expect(unload.error).toBe("INVALID_TRANSITION");
      expect(unload.message).toContain("No match is loaded to unload.");
    }
  });
});
