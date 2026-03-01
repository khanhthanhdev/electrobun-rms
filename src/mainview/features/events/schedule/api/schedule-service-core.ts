import { requestEmpty, requestJson } from "@/shared/api/http-client";

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

const buildSchedulePath = (eventCode: string, scheduleType: string): string =>
  `/events/${encodeURIComponent(eventCode)}/schedule/${encodeURIComponent(scheduleType)}`;

export const fetchSchedule = <TResponse>(
  eventCode: string,
  scheduleType: string,
  token: string
): Promise<TResponse> =>
  requestJson<TResponse>(buildSchedulePath(eventCode, scheduleType), {
    token,
  });

export const saveSchedule = <TResponse, TPayload>(
  eventCode: string,
  scheduleType: string,
  payload: TPayload,
  token: string
): Promise<TResponse> =>
  requestJson<TResponse>(buildSchedulePath(eventCode, scheduleType), {
    method: "PUT",
    token,
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });

export const generateSchedule = <TResponse, TPayload>(
  eventCode: string,
  scheduleType: string,
  payload: TPayload,
  token: string
): Promise<TResponse> =>
  requestJson<TResponse>(
    `${buildSchedulePath(eventCode, scheduleType)}/generate`,
    {
      method: "POST",
      token,
      headers: JSON_HEADERS,
      body: JSON.stringify(payload),
    }
  );

export const clearSchedule = async (
  eventCode: string,
  scheduleType: string,
  token: string
): Promise<void> => {
  await requestEmpty(buildSchedulePath(eventCode, scheduleType), {
    method: "DELETE",
    token,
  });
};

export const setScheduleActivation = <TResponse>(
  eventCode: string,
  scheduleType: string,
  active: boolean,
  token: string
): Promise<TResponse> =>
  requestJson<TResponse>(
    `${buildSchedulePath(eventCode, scheduleType)}/active`,
    {
      method: "PUT",
      token,
      headers: JSON_HEADERS,
      body: JSON.stringify({ active }),
    }
  );
