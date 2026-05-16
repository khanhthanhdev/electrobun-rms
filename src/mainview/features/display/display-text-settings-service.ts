import type { DisplayTextSettings } from "@shared/display";
import { requestJson } from "@/shared/api/http-client";

interface DisplayTextSettingsResponse {
  settings: DisplayTextSettings;
}

const buildPath = (eventCode: string): string =>
  `/events/${encodeURIComponent(eventCode)}/display/settings`;

export const fetchDisplayTextSettings = async (
  eventCode: string
): Promise<DisplayTextSettings> => {
  const response = await requestJson<DisplayTextSettingsResponse>(
    buildPath(eventCode)
  );
  return response.settings;
};

export const saveDisplayTextSettingsRequest = async (
  eventCode: string,
  settings: DisplayTextSettings,
  token: string | null
): Promise<DisplayTextSettings> => {
  const response = await requestJson<DisplayTextSettingsResponse>(
    buildPath(eventCode),
    {
      body: JSON.stringify(settings),
      headers: { "content-type": "application/json" },
      method: "PUT",
      token,
    }
  );
  return response.settings;
};
