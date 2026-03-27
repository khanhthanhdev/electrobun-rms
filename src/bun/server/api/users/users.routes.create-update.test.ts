import { beforeEach, describe, expect, it } from "bun:test";
import {
  createToken,
  createUsersTestApp,
  getStoredUserSnapshot,
  insertEvent,
  insertUser,
  resetUsersTestDatabase,
} from "./users.test-support";

describe("users routes create and update", () => {
  beforeEach(async () => {
    await resetUsersTestDatabase();
  });

  it("preserves create behavior including duplicate-user rejection", async () => {
    insertEvent("EVTUSR1");
    const app = createUsersTestApp();
    const token = await createToken({
      roles: [{ role: "ADMIN", event: "*" }],
    });

    const createResponse = await app.request("http://localhost/", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "casey",
        password: "secure-pass",
        passwordConfirm: "secure-pass",
        roles: [{ role: "REFEREE", event: "EVTUSR1" }],
      }),
    });
    expect(createResponse.status).toBe(201);
    expect(await createResponse.json()).toEqual({
      user: {
        username: "casey",
        type: 0,
        roles: [{ role: "REFEREE", event: "EVTUSR1" }],
      },
    });

    const createdUser = await getStoredUserSnapshot("casey");
    expect(createdUser.user?.username).toBe("casey");
    expect(createdUser.roles).toEqual([{ role: "REFEREE", event: "EVTUSR1" }]);
    expect(
      await Bun.password.verify(
        "secure-pass",
        createdUser.user?.hashedPassword ?? ""
      )
    ).toBe(true);

    const duplicateResponse = await app.request("http://localhost/", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "casey",
        password: "secure-pass",
        passwordConfirm: "secure-pass",
        roles: [{ role: "REFEREE", event: "EVTUSR1" }],
      }),
    });
    expect(duplicateResponse.status).toBe(409);
    expect(await duplicateResponse.json()).toEqual({
      error: "User creation failed",
      message: 'User "casey" already exists.',
    });
  });

  it("preserves create validation errors", async () => {
    insertEvent("EVTUSR2");
    const app = createUsersTestApp();
    const token = await createToken({
      roles: [{ role: "ADMIN", event: "*" }],
    });

    const bodyMismatchResponse = await app.request("http://localhost/", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "mismatch",
        password: "pass-one",
        passwordConfirm: "pass-two",
        roles: [{ role: "REFEREE", event: "EVTUSR2" }],
      }),
    });
    expect(bodyMismatchResponse.status).toBe(400);
    expect(await bodyMismatchResponse.json()).toEqual({
      error: "Validation failed",
      message: "Password and confirmation password do not match.",
    });

    const duplicateRoleResponse = await app.request("http://localhost/", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "dupe",
        password: "secret-pass",
        passwordConfirm: "secret-pass",
        roles: [
          { role: "REFEREE", event: "EVTUSR2" },
          { role: "REFEREE", event: "EVTUSR2" },
        ],
      }),
    });
    expect(duplicateRoleResponse.status).toBe(400);
    expect(await duplicateRoleResponse.json()).toEqual({
      error: "Validation failed",
      message: "Duplicate role assignment: REFEREE for event EVTUSR2.",
    });

    const missingEventResponse = await app.request("http://localhost/", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: "missingevent",
        password: "secret-pass",
        passwordConfirm: "secret-pass",
        roles: [{ role: "REFEREE", event: "NOSUCH" }],
      }),
    });
    expect(missingEventResponse.status).toBe(400);
    expect(await missingEventResponse.json()).toEqual({
      error: "Validation failed",
      message: "Event does not exist: NOSUCH.",
    });
  });

  it("preserves update behavior and update validation", async () => {
    insertEvent("EVTUSR3");
    await insertUser({
      username: "alex",
      password: "old-password",
      roles: [{ role: "REFEREE", event: "EVTUSR3" }],
    });

    const app = createUsersTestApp();
    const token = await createToken({
      roles: [{ role: "ADMIN", event: "*" }],
    });

    const updateResponse = await app.request("http://localhost/alex", {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        password: "new-password",
        passwordConfirm: "new-password",
        roles: [{ role: "HEAD_REFEREE", event: "EVTUSR3" }],
      }),
    });
    expect(updateResponse.status).toBe(200);
    expect(await updateResponse.json()).toEqual({
      user: {
        username: "alex",
        type: 0,
        roles: [{ role: "HEAD_REFEREE", event: "EVTUSR3" }],
      },
    });

    const updatedUser = await getStoredUserSnapshot("alex");
    expect(updatedUser.roles).toEqual([
      { role: "HEAD_REFEREE", event: "EVTUSR3" },
    ]);
    expect(
      await Bun.password.verify(
        "new-password",
        updatedUser.user?.hashedPassword ?? ""
      )
    ).toBe(true);

    const mismatchResponse = await app.request("http://localhost/alex", {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        password: "pass-one",
        passwordConfirm: "pass-two",
        roles: [{ role: "HEAD_REFEREE", event: "EVTUSR3" }],
      }),
    });
    expect(mismatchResponse.status).toBe(400);
    expect(await mismatchResponse.json()).toEqual({
      error: "Validation failed",
      message: "Password and confirmation password do not match.",
    });
  });

  it("preserves missing-user update errors", async () => {
    insertEvent("EVTUSR4");
    const app = createUsersTestApp();
    const token = await createToken({
      roles: [{ role: "ADMIN", event: "*" }],
    });

    const response = await app.request("http://localhost/ghost", {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        password: "new-password",
        passwordConfirm: "new-password",
        roles: [{ role: "REFEREE", event: "EVTUSR4" }],
      }),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Not found",
      message: 'User "ghost" was not found.',
    });
  });
});
