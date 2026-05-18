import { describe, expect, it } from "bun:test";
import { createDisplayCommandRequestBody } from "./display-command-channel";
import {
  parseDisplaySyncEvent,
  parseScoreUpdateEvent,
} from "./display-command-sync-service";

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
      pausedRemainingMs: null,
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
          pausedRemainingMs: 90_000,
          startedAtMs: null,
          version: 7,
        })
      )
    ).toEqual({
      activeMatch,
      loadedMatch,
      message: null,
      mode: "match-preview",
      pausedRemainingMs: 90_000,
      startedAtMs: null,
    });
  });

  it("returns null for invalid display sync payloads", () => {
    expect(parseDisplaySyncEvent("not-json")).toBeNull();
    expect(parseDisplaySyncEvent(JSON.stringify("bad"))).toBeNull();
    expect(
      parseDisplaySyncEvent(
        JSON.stringify({ kind: "SNAPSHOT_HINT", mode: null })
      )
    ).toBeNull();
    expect(
      parseDisplaySyncEvent(JSON.stringify({ kind: "COMMAND_ISSUED", mode: 1 }))
    ).toBeNull();
  });

  it("normalizes malformed optional display fields", () => {
    expect(
      parseDisplaySyncEvent(
        JSON.stringify({
          activeMatch: { matchName: "Q1" },
          kind: "COMMAND_ISSUED",
          loadedMatch: "bad",
          message: 99,
          mode: "match-start",
          startedAtMs: "123",
        })
      )
    ).toEqual({
      activeMatch: null,
      loadedMatch: null,
      message: null,
      mode: "match-start",
      pausedRemainingMs: null,
      startedAtMs: null,
    });
  });

  it("parses a valid score update event", () => {
    expect(
      parseScoreUpdateEvent(
        JSON.stringify({
          changedAt: "2026-04-03T12:00:00.000Z",
          eventCode: "S4V1",
          kind: "SCORE_UPDATE",
          matchNumber: 3,
          matchType: "quals",
          version: 5,
        })
      )
    ).toEqual({
      changedAt: "2026-04-03T12:00:00.000Z",
      eventCode: "S4V1",
      kind: "SCORE_UPDATE",
      matchNumber: 3,
      matchType: "quals",
      version: 5,
    });
  });

  it("accepts score updates with nullable match fields", () => {
    expect(
      parseScoreUpdateEvent(
        JSON.stringify({
          changedAt: "2026-04-03T12:00:00.000Z",
          eventCode: "S4V1",
          kind: "SCORE_UPDATE",
          matchNumber: null,
          matchType: null,
          version: 5,
        })
      )
    ).toEqual({
      changedAt: "2026-04-03T12:00:00.000Z",
      eventCode: "S4V1",
      kind: "SCORE_UPDATE",
      matchNumber: null,
      matchType: null,
      version: 5,
    });
  });

  it("accepts display settings update events as display refresh triggers", () => {
    expect(
      parseScoreUpdateEvent(
        JSON.stringify({
          changedAt: "2026-04-03T12:00:00.000Z",
          eventCode: "S4V1",
          kind: "DISPLAY_SETTINGS_UPDATED",
          matchNumber: null,
          matchType: null,
          version: 6,
        })
      )
    ).toEqual({
      changedAt: "2026-04-03T12:00:00.000Z",
      eventCode: "S4V1",
      kind: "DISPLAY_SETTINGS_UPDATED",
      matchNumber: null,
      matchType: null,
      version: 6,
    });
  });

  it("returns null for invalid score update payloads", () => {
    const validPayload = {
      changedAt: "2026-04-03T12:00:00.000Z",
      eventCode: "S4V1",
      kind: "SCORE_UPDATE",
      matchNumber: 1,
      matchType: "practice",
      version: 1,
    };

    const invalidPayloads = [
      "not-json",
      JSON.stringify("bad"),
      JSON.stringify({ ...validPayload, changedAt: 1 }),
      JSON.stringify({ ...validPayload, eventCode: 1 }),
      JSON.stringify({ ...validPayload, kind: "SNAPSHOT_HINT" }),
      JSON.stringify({ ...validPayload, version: -1 }),
      JSON.stringify({ ...validPayload, version: 1.5 }),
      JSON.stringify({ ...validPayload, matchNumber: 0 }),
      JSON.stringify({ ...validPayload, matchNumber: 2.2 }),
      JSON.stringify({ ...validPayload, matchNumber: "1" }),
      JSON.stringify({ ...validPayload, matchType: 1 }),
    ];

    for (const payload of invalidPayloads) {
      expect(parseScoreUpdateEvent(payload)).toBeNull();
    }
  });
});
