import { describe, expect, it } from "bun:test";
import type { MatchControlState } from "@shared/match-control";
import { publishDisplayFromMatchControl } from "./display-match-control-bridge";
import { displaySyncHub } from "./display-sync";

const eventCode = `TEST_DISPLAY_BRIDGE_${Math.random().toString(36).slice(2, 8)}`;

const completedState: MatchControlState = {
  eventCode,
  version: 0,
  loadedMatch: null,
  loadedState: "IDLE",
  activeMatch: {
    matchNumber: 1,
    matchType: "quals",
    matchName: "Q1",
    fieldNumber: 1,
    redTeam: 101,
    redTeamName: "Red 1",
    blueTeam: 201,
    blueTeamName: "Blue 1",
  },
  activeState: "COMPLETED",
  activeStartedAtMs: 123_456,
};

describe("display match-control bridge", () => {
  it("publishes match-complete mode for AUTO_COMPLETE", () => {
    publishDisplayFromMatchControl(completedState, "AUTO_COMPLETE");

    const latest = displaySyncHub.getLatestEvent(eventCode);
    expect(latest).not.toBeNull();
    expect(latest?.mode).toBe("match-complete");
    expect(latest?.activeMatch?.matchNumber).toBe(1);
  });
});
