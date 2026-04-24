import { describe, expect, it } from "bun:test";
import {
  accountFormErrorMessages,
  accountFormReducer,
  createAccountFormInitialState,
  roleKey,
  validateAccountFormForSubmit,
} from "./account-form-controller";

describe("accountFormReducer", () => {
  it("toggles role keys on and off", () => {
    const key = roleKey("nrc2026", "ADMIN");
    const initialState = createAccountFormInitialState("admin");

    const withRole = accountFormReducer(initialState, {
      key,
      type: "toggleRole",
    });

    expect(withRole.selectedRoles.has(key)).toBe(true);

    const withoutRole = accountFormReducer(withRole, {
      key,
      type: "toggleRole",
    });

    expect(withoutRole.selectedRoles.has(key)).toBe(false);
  });
});

describe("validateAccountFormForSubmit", () => {
  it("requires username for create mode", () => {
    const error = validateAccountFormForSubmit({
      mode: "create",
      state: {
        accountUsername: "",
        password: "a",
        passwordConfirm: "a",
        selectedRoles: new Set(["*:ADMIN"]),
      },
    });

    expect(error).toBe(accountFormErrorMessages.missingUsername);
  });

  it("requires password and confirm for create mode", () => {
    const error = validateAccountFormForSubmit({
      mode: "create",
      state: {
        accountUsername: "user",
        password: "",
        passwordConfirm: "",
        selectedRoles: new Set(["*:ADMIN"]),
      },
    });

    expect(error).toBe(accountFormErrorMessages.missingPassword);
  });

  it("requires matching password values in both modes", () => {
    const createError = validateAccountFormForSubmit({
      mode: "create",
      state: {
        accountUsername: "user",
        password: "abc",
        passwordConfirm: "xyz",
        selectedRoles: new Set(["*:ADMIN"]),
      },
    });

    const manageError = validateAccountFormForSubmit({
      mode: "manage",
      state: {
        accountUsername: "user",
        password: "abc",
        passwordConfirm: "xyz",
        selectedRoles: new Set(["*:ADMIN"]),
      },
    });

    expect(createError).toBe(accountFormErrorMessages.passwordMismatch);
    expect(manageError).toBe(accountFormErrorMessages.passwordMismatch);
  });

  it("requires at least one selected role for both modes", () => {
    const createError = validateAccountFormForSubmit({
      mode: "create",
      state: {
        accountUsername: "user",
        password: "abc",
        passwordConfirm: "abc",
        selectedRoles: new Set(),
      },
    });

    const manageError = validateAccountFormForSubmit({
      mode: "manage",
      state: {
        accountUsername: "user",
        password: "",
        passwordConfirm: "",
        selectedRoles: new Set(),
      },
    });

    expect(createError).toBe(accountFormErrorMessages.missingRoles);
    expect(manageError).toBe(accountFormErrorMessages.missingRoles);
  });

  it("allows manage mode without password update", () => {
    const error = validateAccountFormForSubmit({
      mode: "manage",
      state: {
        accountUsername: "user",
        password: "",
        passwordConfirm: "",
        selectedRoles: new Set(["*:ADMIN"]),
      },
    });

    expect(error).toBeNull();
  });
});
