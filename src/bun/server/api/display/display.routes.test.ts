import { beforeEach, describe, expect, it, jest } from "bun:test";
import {
  createAdminToken,
  createDisplayEventDb,
  createDisplayTestApp,
  DISPLAY_SYNC_EVENT_NAME,
  resetDisplayTestDatabase,
  scoringSyncHub,
} from "./display.test-support";

const SCORE_UPDATE_EVENT_NAME = "display.change" as const;

const readChunk = async (
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<string> => {
  const result = await reader.read();
  if (result.done || !result.value) {
    throw new Error("Expected an SSE chunk.");
  }

  return new TextDecoder().decode(result.value);
};

describe("display routes", () => {
  beforeEach(async () => {
    await resetDisplayTestDatabase();
  });

  it("rejects unauthenticated display commands", async () => {
    const eventCode = "DSPAUTH1";
    const app = createDisplayTestApp();

    const response = await app.request(
      `http://localhost/${eventCode}/display/command`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ mode: "blank" }),
      }
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("keeps display command writes behind the event admin guard", async () => {
    const eventCode = "DSPAUTH2";
    const wrongEventToken = await createAdminToken("OTHER");
    const app = createDisplayTestApp();

    const response = await app.request(
      `http://localhost/${eventCode}/display/command`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${wrongEventToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ mode: "blank" }),
      }
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Forbidden",
      message: `Admin access for event "${eventCode}" is required.`,
    });
  });

  it("streams snapshots, heartbeats, commands, and scoring bridge updates", async () => {
    const eventCode = "DSPSTRM1";
    const token = await createAdminToken(eventCode);
    const app = createDisplayTestApp();

    jest.useFakeTimers();

    const response = await app.request(
      `http://localhost/${eventCode}/display/stream`
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    if (!reader) {
      jest.useRealTimers();
      return;
    }

    try {
      const snapshotChunk = await readChunk(reader);
      expect(snapshotChunk).toContain(`event: ${DISPLAY_SYNC_EVENT_NAME}`);
      expect(snapshotChunk).toContain(`id: ${eventCode}:0`);
      expect(snapshotChunk).toContain('"kind":"SNAPSHOT_HINT"');

      jest.advanceTimersByTime(20_000);
      const heartbeatChunk = await readChunk(reader);
      expect(heartbeatChunk).toContain(": heartbeat");

      const commandResponse = await app.request(
        `http://localhost/${eventCode}/display/command`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            mode: "blank",
            message: "Intermission",
          }),
        }
      );

      expect(commandResponse.status).toBe(200);
      expect(await commandResponse.json()).toEqual({ ok: true });

      const commandChunk = await readChunk(reader);
      expect(commandChunk).toContain(`event: ${DISPLAY_SYNC_EVENT_NAME}`);
      expect(commandChunk).toContain(`id: ${eventCode}:`);
      expect(commandChunk).toContain('"kind":"COMMAND_ISSUED"');
      expect(commandChunk).toContain('"mode":"blank"');
      expect(commandChunk).toContain('"message":"Intermission"');

      scoringSyncHub.publish({
        eventCode,
        kind: "SCORE_UPDATED",
        matchNumber: 3,
        matchType: "quals",
      });

      const scoreUpdateChunk = await readChunk(reader);
      expect(scoreUpdateChunk).toContain(`event: ${SCORE_UPDATE_EVENT_NAME}`);
      expect(scoreUpdateChunk).toContain(`id: ${eventCode}:`);
      expect(scoreUpdateChunk).toContain('"kind":"SCORE_UPDATE"');
      expect(scoreUpdateChunk).toContain('"matchNumber":3');
      expect(scoreUpdateChunk).toContain('"matchType":"quals"');
    } finally {
      await reader.cancel();
      jest.useRealTimers();
    }
  });

  it("returns default display text settings when no saved config exists", async () => {
    const eventCode = "DSPSET1";
    createDisplayEventDb(eventCode);
    const app = createDisplayTestApp();

    const response = await app.request(
      `http://localhost/${eventCode}/display/settings`
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      settings: {
        headerMode: "default",
        customHeaderText: "",
        headerFontSize: 64,
        headerColor: "#ffffff",
        footerText: "HÀNH TINH 4.0",
        footerFontSize: 23,
        footerColor: "#0a0930",
      },
    });
  });

  it("keeps display text settings writes behind auth and event admin guard", async () => {
    const eventCode = "DSPSET2";
    createDisplayEventDb(eventCode);
    const wrongEventToken = await createAdminToken("OTHER");
    const app = createDisplayTestApp();

    const unauthenticated = await app.request(
      `http://localhost/${eventCode}/display/settings`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ footerText: "Finals" }),
      }
    );
    expect(unauthenticated.status).toBe(401);

    const wrongEvent = await app.request(
      `http://localhost/${eventCode}/display/settings`,
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${wrongEventToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ footerText: "Finals" }),
      }
    );
    expect(wrongEvent.status).toBe(403);
  });

  it("rejects custom header mode without custom header text", async () => {
    const eventCode = "DSPSET3";
    createDisplayEventDb(eventCode);
    const token = await createAdminToken(eventCode);
    const app = createDisplayTestApp();

    const response = await app.request(
      `http://localhost/${eventCode}/display/settings`,
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          headerMode: "custom",
          customHeaderText: "   ",
          footerText: "Finals",
        }),
      }
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Validation failed",
      message: "Custom header text is required when custom mode is used.",
    });
  });

  it("persists normalized display text settings", async () => {
    const eventCode = "DSPSET4";
    createDisplayEventDb(eventCode);
    const token = await createAdminToken(eventCode);
    const app = createDisplayTestApp();

    const saveResponse = await app.request(
      `http://localhost/${eventCode}/display/settings`,
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          headerMode: "custom",
          customHeaderText: "  Final Match  ",
          headerFontSize: 200,
          headerColor: "#FFDD00",
          footerText: "   ",
          footerFontSize: 3,
          footerColor: "not-a-color",
        }),
      }
    );

    expect(saveResponse.status).toBe(200);
    expect(await saveResponse.json()).toEqual({
      settings: {
        headerMode: "custom",
        customHeaderText: "Final Match",
        headerFontSize: 96,
        headerColor: "#ffdd00",
        footerText: "HÀNH TINH 4.0",
        footerFontSize: 14,
        footerColor: "#0a0930",
      },
    });

    const getResponse = await app.request(
      `http://localhost/${eventCode}/display/settings`
    );
    expect(await getResponse.json()).toEqual({
      settings: {
        headerMode: "custom",
        customHeaderText: "Final Match",
        headerFontSize: 96,
        headerColor: "#ffdd00",
        footerText: "HÀNH TINH 4.0",
        footerFontSize: 14,
        footerColor: "#0a0930",
      },
    });
  });

  it("streams display settings update events over display change", async () => {
    const eventCode = "DSPSET5";
    createDisplayEventDb(eventCode);
    const token = await createAdminToken(eventCode);
    const app = createDisplayTestApp();

    const response = await app.request(
      `http://localhost/${eventCode}/display/stream`
    );
    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    if (!reader) {
      return;
    }

    try {
      await readChunk(reader);
      const saveResponse = await app.request(
        `http://localhost/${eventCode}/display/settings`,
        {
          method: "PUT",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            headerMode: "default",
            customHeaderText: "",
            headerFontSize: 64,
            headerColor: "#ffffff",
            footerText: "Finals",
            footerFontSize: 23,
            footerColor: "#0a0930",
          }),
        }
      );

      expect(saveResponse.status).toBe(200);
      const settingsChunk = await readChunk(reader);
      expect(settingsChunk).toContain(`event: ${SCORE_UPDATE_EVENT_NAME}`);
      expect(settingsChunk).toContain('"kind":"DISPLAY_SETTINGS_UPDATED"');
    } finally {
      await reader.cancel();
    }
  });
});
