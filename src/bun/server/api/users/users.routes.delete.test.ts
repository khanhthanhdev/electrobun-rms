import { beforeEach, describe, expect, it } from "bun:test";
import {
  createToken,
  createUsersTestApp,
  getStoredUserSnapshot,
  insertUser,
  resetUsersTestDatabase,
} from "./users.test-support";

describe("users routes delete", () => {
  beforeEach(async () => {
    await resetUsersTestDatabase();
  });

  it("preserves self-delete and last-global-admin protections", async () => {
    await insertUser({
      username: "moderator",
      roles: [{ role: "REFEREE", event: "EVTDEL1" }],
    });

    const app = createUsersTestApp();
    const adminToken = await createToken({
      username: "admin",
      roles: [{ role: "ADMIN", event: "*" }],
    });

    const selfDeleteResponse = await app.request("http://localhost/admin", {
      method: "DELETE",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(selfDeleteResponse.status).toBe(400);
    expect(await selfDeleteResponse.json()).toEqual({
      error: "Validation failed",
      message: "You cannot delete the currently logged in user.",
    });

    const moderatorToken = await createToken({
      username: "moderator",
      roles: [{ role: "ADMIN", event: "*" }],
    });
    const lastAdminResponse = await app.request("http://localhost/admin", {
      method: "DELETE",
      headers: { authorization: `Bearer ${moderatorToken}` },
    });
    expect(lastAdminResponse.status).toBe(400);
    expect(await lastAdminResponse.json()).toEqual({
      error: "Validation failed",
      message: "Cannot delete the last global admin user.",
    });
  });

  it("preserves successful deletion and missing-user errors", async () => {
    await insertUser({
      username: "target",
      roles: [{ role: "REFEREE", event: "EVTDEL2" }],
    });
    await insertUser({
      username: "coadmin",
      roles: [{ role: "ADMIN", event: "*" }],
    });

    const app = createUsersTestApp();
    const token = await createToken({
      username: "coadmin",
      roles: [{ role: "ADMIN", event: "*" }],
    });

    const deleteResponse = await app.request("http://localhost/target", {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(deleteResponse.status).toBe(200);
    expect(await deleteResponse.json()).toEqual({ ok: true });
    expect((await getStoredUserSnapshot("target")).user).toBeNull();

    const missingResponse = await app.request("http://localhost/ghost", {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(missingResponse.status).toBe(404);
    expect(await missingResponse.json()).toEqual({
      error: "Not found",
      message: 'User "ghost" was not found.',
    });
  });

  it("preserves username validation on delete", async () => {
    const app = createUsersTestApp();
    const token = await createToken({
      roles: [{ role: "ADMIN", event: "*" }],
    });

    const response = await app.request("http://localhost/bad.name", {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Validation failed",
      message: "Invalid username.",
    });
  });
});
