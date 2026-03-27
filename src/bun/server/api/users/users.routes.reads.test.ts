import { beforeEach, describe, expect, it } from "bun:test";
import {
  createToken,
  createUsersTestApp,
  insertUser,
  resetUsersTestDatabase,
} from "./users.test-support";

describe("users routes reads", () => {
  beforeEach(async () => {
    await resetUsersTestDatabase();
  });

  it("preserves list and detail responses for global admins", async () => {
    await insertUser({
      username: "zoe",
      roles: [{ role: "REFEREE", event: "EVTREAD1" }],
    });

    const app = createUsersTestApp();
    const token = await createToken({
      roles: [{ role: "ADMIN", event: "*" }],
    });

    const listResponse = await app.request("http://localhost/", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toEqual({
      users: [
        { generic: false, type: 0, used: true, username: "admin" },
        { generic: false, type: 0, used: true, username: "zoe" },
      ],
    });

    const detailResponse = await app.request("http://localhost/zoe", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(detailResponse.status).toBe(200);
    expect(await detailResponse.json()).toEqual({
      user: {
        generic: false,
        type: 0,
        used: true,
        username: "zoe",
        roles: [{ role: "REFEREE", event: "EVTREAD1" }],
      },
    });
  });

  it("preserves auth and admin guard behavior", async () => {
    const app = createUsersTestApp();

    const unauthorizedResponse = await app.request("http://localhost/");
    expect(unauthorizedResponse.status).toBe(401);
    expect(await unauthorizedResponse.json()).toEqual({
      error: "Unauthorized",
    });

    const nonAdminToken = await createToken({
      username: "judge",
      roles: [{ role: "JUDGE", event: "*" }],
    });
    const forbiddenResponse = await app.request("http://localhost/", {
      headers: { authorization: `Bearer ${nonAdminToken}` },
    });
    expect(forbiddenResponse.status).toBe(403);
    expect(await forbiddenResponse.json()).toEqual({
      error: "Forbidden",
      message: "Admin access required.",
    });
  });

  it("preserves username validation and missing-user responses", async () => {
    const app = createUsersTestApp();
    const token = await createToken({
      roles: [{ role: "ADMIN", event: "*" }],
    });

    const invalidUsernameResponse = await app.request(
      "http://localhost/bad.name",
      {
        headers: { authorization: `Bearer ${token}` },
      }
    );
    expect(invalidUsernameResponse.status).toBe(400);
    expect(await invalidUsernameResponse.json()).toEqual({
      error: "Validation failed",
      message: "Invalid username.",
    });

    const missingUserResponse = await app.request("http://localhost/missing", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(missingUserResponse.status).toBe(404);
    expect(await missingUserResponse.json()).toEqual({
      error: "Not found",
      message: 'User "missing" was not found.',
    });
  });
});
