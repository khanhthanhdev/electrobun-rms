import { describe, expect, it } from "bun:test";
import { createDisplayCommandRequestBody } from "./display-command-channel";
import { parseDisplaySyncEvent } from "./display-command-sync-service";

const loadedMatch = {
  blueTeam: 222,
  blueTeamName: "Blue Bots",
  fieldNumber: 1,
  matchName: "Q1",
  matchNumber: 1,
  matchType: "quals",
  redTeam: 111,
  redTeamName: "Red Bots",
} as const;

const activeMatch = {
  blueTeam: 444,
  blueTeamName: "Live Blue",
  fieldNumber: 2,
  matchName: "Q2",
  matchNumber: 2,
  matchType: "practice",
  redTeam: 333,
  redTeamName: "Live Red",
} as const;

describe("display command sync service", () => {
  it("serializes match context into the display command request body", () => {
    expect(
      createDisplayCommandRequestBody({
        activeMatch,
        loadedMatch,
        mode: "match-start",
        startedAtMs: 12_345,
      })
    ).toEqual({
      activeMatch,
      loadedMatch,
      message: null,
      mode: "match-start",
      startedAtMs: 12_345,
    });
  });

  it("parses display sync events with loaded and active matches", () => {
    expect(
      parseDisplaySyncEvent(
        JSON.stringify({
          activeMatch,
          changedAt: "2026-04-03T12:00:00.000Z",
          eventCode: "S4V1",
          kind: "COMMAND_ISSUED",
          loadedMatch,
          message: null,
          mode: "match-preview",
          startedAtMs: null,
          version: 7,
        })
      )
    ).toEqual({
      activeMatch,
      loadedMatch,
      message: null,
      mode: "match-preview",
      startedAtMs: null,
    });
  });
});
