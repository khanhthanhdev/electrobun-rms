import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { SQLiteScoringRepository } from "../../infrastructure/adapters/scoring";
import {
  createAdminToken,
  createScoringEventDb,
  insertEvent,
  resetScoringTestDatabase,
  scoringSyncHub,
} from "../scoring/scoring.test-support";

const matchControlRoutesModule = await import("./match-control.routes");
const displaySyncModule = await import("../display/display-sync");

const { matchControlRoutes } = matchControlRoutesModule;
const { displaySyncHub } = displaySyncModule;
const scoringRepository = new SQLiteScoringRepository();

const createMatchControlTestApp = (): Hono => {
  const app = new Hono();
  app.route("/", matchControlRoutes);
  return app;
};

const createMatchRef = (matchNumber: number) => ({
  blueTeam: 222,
  blueTeamName: "Blue Bots",
  fieldNumber: 1,
  matchName: `Q${matchNumber}`,
  matchNumber,
  matchType: "quals" as const,
  redTeam: 111,
  redTeamName: "Red Bots",
});

const createAuthHeaders = (token: string) => ({
  authorization: `Bearer ${token}`,
  "content-type": "application/json",
});

const postMatchControl = (
  app: Hono,
  eventCode: string,
  path: string,
  token: string,
  body: unknown
): Promise<Response> =>
  Promise.resolve(
    app.request(`http://localhost/${eventCode}/match-control/${path}`, {
      body: JSON.stringify(body),
      headers: createAuthHeaders(token),
      method: "POST",
    })
  );

describe("match control routes", () => {
  it("publishes match-winner display mode for committed match results", async () => {
    await resetScoringTestDatabase();
    const eventCode = `MCRSHOW${Math.random().toString(36).slice(2, 8)}`;
    insertEvent(eventCode);
    createScoringEventDb(eventCode, {
      blueScore: 84,
      matchNumber: 3,
      redScore: 128,
    });
    const token = await createAdminToken(eventCode);
    const app = createMatchControlTestApp();

    const response = await app.request(
      `http://localhost/${eventCode}/match-control/show-results`,
      {
        body: JSON.stringify({ match: createMatchRef(3) }),
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        method: "POST",
      }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });

    const latest = displaySyncHub.getLatestEvent(eventCode);
    expect(latest?.mode).toBe("match-winner");
    expect(latest?.activeMatch?.matchNumber).toBe(3);
  });

  it("rejects showing results for an incomplete match", async () => {
    await resetScoringTestDatabase();
    const eventCode = `MCRINCOMP${Math.random().toString(36).slice(2, 8)}`;
    insertEvent(eventCode);
    createScoringEventDb(eventCode, {
      blueScore: 84,
      matchNumber: 4,
      redScore: 128,
    });
    const token = await createAdminToken(eventCode);
    const app = createMatchControlTestApp();
    const initialScoringVersion = scoringSyncHub.getCurrentVersion(eventCode);

    await app.request(
      `http://localhost/${eventCode}/match-control/clear-scores`,
      {
        body: JSON.stringify({ matchType: "quals", matchNumber: 4 }),
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        method: "POST",
      }
    );

    const response = await app.request(
      `http://localhost/${eventCode}/match-control/show-results`,
      {
        body: JSON.stringify({ match: createMatchRef(4) }),
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        method: "POST",
      }
    );

    expect(response.status).toBe(409);
    expect(scoringSyncHub.getCurrentVersion(eventCode)).toBeGreaterThan(
      initialScoringVersion
    );
    expect(await response.json()).toEqual({
      error: "MATCH_NOT_COMMITTED",
      message: "Cannot show results for a match without committed scores.",
    });
  });

  it("clears scores server-side before loading a replayed match", async () => {
    await resetScoringTestDatabase();
    const eventCode = `MCRLOAD${Math.random().toString(36).slice(2, 8)}`;
    insertEvent(eventCode);
    createScoringEventDb(eventCode, {
      blueScore: 40,
      matchNumber: 5,
      redScore: 50,
    });
    const token = await createAdminToken(eventCode);
    const app = createMatchControlTestApp();
    const initialScoringVersion = scoringSyncHub.getCurrentVersion(eventCode);

    const response = await postMatchControl(app, eventCode, "load", token, {
      expectedVersion: 0,
      match: createMatchRef(5),
      resetScoresBeforeLoad: true,
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.state.loadedMatch.matchNumber).toBe(5);
    expect(body.state.loadedState).toBe("LOADED");

    const results = await scoringRepository.getMatchResults(eventCode, "quals");
    expect(results.find((row) => row.matchNumber === 5)).toMatchObject({
      blueScore: null,
      redScore: null,
    });
    expect(scoringSyncHub.getCurrentVersion(eventCode)).toBeGreaterThan(
      initialScoringVersion
    );
  });

  it("does not clear scores when replay load validation fails", async () => {
    await resetScoringTestDatabase();
    const eventCode = `MCRLOADFAIL${Math.random().toString(36).slice(2, 8)}`;
    insertEvent(eventCode);
    createScoringEventDb(eventCode, {
      blueScore: 24,
      matchNumber: 6,
      redScore: 42,
    });
    const token = await createAdminToken(eventCode);
    const app = createMatchControlTestApp();

    const firstLoad = await postMatchControl(app, eventCode, "load", token, {
      expectedVersion: 0,
      match: createMatchRef(6),
    });
    expect(firstLoad.status).toBe(200);

    const rejectedLoad = await postMatchControl(app, eventCode, "load", token, {
      expectedVersion: 1,
      match: createMatchRef(6),
      resetScoresBeforeLoad: true,
    });

    expect(rejectedLoad.status).toBe(409);
    const results = await scoringRepository.getMatchResults(eventCode, "quals");
    expect(results.find((row) => row.matchNumber === 6)).toMatchObject({
      blueScore: 24,
      redScore: 42,
    });
  });

  it("awaits score clearing before returning from abort", async () => {
    await resetScoringTestDatabase();
    const eventCode = `MCRABORT${Math.random().toString(36).slice(2, 8)}`;
    insertEvent(eventCode);
    createScoringEventDb(eventCode, {
      blueScore: 17,
      matchNumber: 7,
      redScore: 31,
    });
    const token = await createAdminToken(eventCode);
    const app = createMatchControlTestApp();
    const initialScoringVersion = scoringSyncHub.getCurrentVersion(eventCode);

    let response = await postMatchControl(app, eventCode, "load", token, {
      expectedVersion: 0,
      match: createMatchRef(7),
    });
    expect(response.status).toBe(200);
    let body = await response.json();
    response = await postMatchControl(app, eventCode, "show-preview", token, {
      expectedVersion: body.version,
    });
    expect(response.status).toBe(200);
    body = await response.json();
    response = await postMatchControl(app, eventCode, "show-match", token, {
      expectedVersion: body.version,
    });
    expect(response.status).toBe(200);
    body = await response.json();
    response = await postMatchControl(app, eventCode, "start", token, {
      expectedVersion: body.version,
    });
    expect(response.status).toBe(200);
    body = await response.json();

    response = await postMatchControl(app, eventCode, "abort", token, {
      expectedVersion: body.version,
    });

    expect(response.status).toBe(200);
    body = await response.json();
    expect(body.state.activeState).toBe("IDLE");
    expect(body.state.loadedMatch.matchNumber).toBe(7);

    const results = await scoringRepository.getMatchResults(eventCode, "quals");
    expect(results.find((row) => row.matchNumber === 7)).toMatchObject({
      blueScore: null,
      redScore: null,
    });
    expect(scoringSyncHub.getCurrentVersion(eventCode)).toBeGreaterThan(
      initialScoringVersion
    );
  });
});
