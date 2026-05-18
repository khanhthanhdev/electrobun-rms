import type { DisplayMatchRef } from "@shared/display";
import type { MatchControlState } from "@shared/match-control";

interface MatchControlStateResponse {
  state: MatchControlState;
  version: number;
}

interface MatchControlTransitionResponse {
  state: MatchControlState;
  version: number;
}

export interface MatchControlErrorBody {
  currentState?: MatchControlState;
  error: "STATE_CONFLICT" | "INVALID_TRANSITION" | string;
  message: string;
}

export class MatchControlTransitionError extends Error {
  readonly body: MatchControlErrorBody;

  constructor(body: MatchControlErrorBody) {
    super(body.message);
    this.name = "MatchControlTransitionError";
    this.body = body;
  }
}

const API_BASE_URL = "/api" as const;

const buildHeaders = (token?: string | null, extra?: HeadersInit): Headers => {
  const headers = new Headers(extra);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
};

const matchControlRequest = async <T>(
  path: string,
  options: {
    token?: string | null;
    method?: string;
    body?: string;
    headers?: HeadersInit;
  } = {}
): Promise<T> => {
  const { token, ...rest } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: buildHeaders(token, rest.headers),
  });

  if (!response.ok) {
    try {
      const errorBody = (await response.json()) as MatchControlErrorBody;
      throw new MatchControlTransitionError(errorBody);
    } catch (err) {
      if (err instanceof MatchControlTransitionError) {
        throw err;
      }
      throw new Error(`Request failed with status ${response.status}`);
    }
  }

  return (await response.json()) as T;
};

const matchControlPath = (eventCode: string, action: string): string =>
  `/events/${encodeURIComponent(eventCode)}/match-control/${action}`;

export const fetchMatchControlState = (
  eventCode: string,
  token: string
): Promise<MatchControlStateResponse> =>
  matchControlRequest<MatchControlStateResponse>(
    matchControlPath(eventCode, "state"),
    {
      token,
    }
  );

export const postMatchControlLoad = (
  eventCode: string,
  token: string,
  match: DisplayMatchRef,
  expectedVersion: number,
  options: { resetScoresBeforeLoad?: boolean } = {}
): Promise<MatchControlTransitionResponse> =>
  matchControlRequest<MatchControlTransitionResponse>(
    matchControlPath(eventCode, "load"),
    {
      body: JSON.stringify({
        match,
        expectedVersion,
        resetScoresBeforeLoad: options.resetScoresBeforeLoad,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      token,
    }
  );

export const postMatchControlTransition = (
  eventCode: string,
  token: string,
  action:
    | "unload"
    | "show-preview"
    | "show-match"
    | "start"
    | "pause"
    | "resume"
    | "abort"
    | "commit",
  expectedVersion: number
): Promise<MatchControlTransitionResponse> =>
  matchControlRequest<MatchControlTransitionResponse>(
    matchControlPath(eventCode, action),
    {
      body: JSON.stringify({ expectedVersion }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      token,
    }
  );

/**
 * Wipe all saved scores for a match so it returns to the UNPLAYED state.
 *
 * Server rejects this with 409 if the match is currently loaded or active —
 * use unload / abort first in that case.
 */
export const postMatchControlClearScores = (
  eventCode: string,
  token: string,
  matchType: "practice" | "quals" | "elims",
  matchNumber: number
): Promise<{ ok: true; state: MatchControlState; version: number }> =>
  matchControlRequest<{ ok: true; state: MatchControlState; version: number }>(
    matchControlPath(eventCode, "clear-scores"),
    {
      body: JSON.stringify({ matchType, matchNumber }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      token,
    }
  );

export const postMatchControlShowResults = (
  eventCode: string,
  token: string,
  match: DisplayMatchRef
): Promise<{ ok: true }> =>
  matchControlRequest<{ ok: true }>(
    matchControlPath(eventCode, "show-results"),
    {
      body: JSON.stringify({ match }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      token,
    }
  );
