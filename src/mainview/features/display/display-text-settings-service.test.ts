import { afterEach, describe, expect, it, mock } from "bun:test";
import {
  fetchDisplayTextSettings,
  saveDisplayTextSettingsRequest,
} from "./display-text-settings-service";

const originalFetch = globalThis.fetch;

describe("display text settings service", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    mock.restore();
  });

  it("builds the display text settings GET request", async () => {
    const fetchMock = mock(async () =>
      Response.json({
        settings: {
          headerMode: "default",
          customHeaderText: "",
          headerFontSize: 64,
          headerColor: "#ffffff",
          footerText: "HÀNH TINH 4.0",
          footerFontSize: 23,
          footerColor: "#0a0930",
        },
      })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const settings = await fetchDisplayTextSettings("S4V 1");

    expect(settings.footerText).toBe("HÀNH TINH 4.0");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/events/S4V%201/display/settings",
      { headers: new Headers() }
    );
  });

  it("builds the display text settings PUT request", async () => {
    const fetchMock = mock(async () =>
      Response.json({
        settings: {
          headerMode: "custom",
          customHeaderText: "Final Match",
          headerFontSize: 72,
          headerColor: "#ffdd00",
          footerText: "Finals",
          footerFontSize: 28,
          footerColor: "#101010",
        },
      })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const settings = await saveDisplayTextSettingsRequest(
      "S4V1",
      {
        headerMode: "custom",
        customHeaderText: "Final Match",
        headerFontSize: 72,
        headerColor: "#ffdd00",
        footerText: "Finals",
        footerFontSize: 28,
        footerColor: "#101010",
      },
      "token-1"
    );

    expect(settings.customHeaderText).toBe("Final Match");
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit?][];
    const [url, init] = calls[0] ?? [];
    expect(url).toBe("/api/events/S4V1/display/settings");
    expect(init?.method).toBe("PUT");
    expect(init?.body).toBe(
      JSON.stringify({
        headerMode: "custom",
        customHeaderText: "Final Match",
        headerFontSize: 72,
        headerColor: "#ffdd00",
        footerText: "Finals",
        footerFontSize: 28,
        footerColor: "#101010",
      })
    );
    expect((init?.headers as Headers).get("authorization")).toBe(
      "Bearer token-1"
    );
    expect((init?.headers as Headers).get("content-type")).toBe(
      "application/json"
    );
  });
});
