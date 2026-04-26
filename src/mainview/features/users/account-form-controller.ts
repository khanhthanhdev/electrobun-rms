import { useMemo, useReducer } from "react";
import type { RoleValue } from "@/shared/constants/roles";
import type { EventItem } from "@/shared/types/event";

export const ALL_EVENTS_CODE = "*" as const;

export type AccountFormMode = "create" | "manage";

export interface AccountFormState {
  accountUsername: string;
  errorMessage: string | null;
  isSubmitting: boolean;
  password: string;
  passwordConfirm: string;
  selectedRoles: Set<string>;
  showPassword: boolean;
  showPasswordConfirm: boolean;
  successMessage: string | null;
}

export type AccountFormAction =
  | {
      payload: Partial<AccountFormState>;
      type: "set";
    }
  | {
      key: string;
      type: "toggleRole";
    };

export const accountFormErrorMessages = {
  missingPassword: "Password and re-enter password are required.",
  missingRoles: "Select at least one role assignment.",
  missingUsername: "Username is required.",
  passwordMismatch: "Password and re-enter password must match.",
} as const;

export const roleKey = (eventCode: string, role: RoleValue): string =>
  `${eventCode}:${role}`;

export const parseRoleKey = (
  value: string
): { event: string; role: RoleValue } => {
  const [event, role] = value.split(":", 2);
  return {
    event,
    role: role as RoleValue,
  };
};

export const buildEventRows = (events: readonly EventItem[]): string[] => {
  const dedupedCodes = Array.from(new Set(events.map((event) => event.code)));
  return [ALL_EVENTS_CODE, ...dedupedCodes];
};

export const normalizeAccountUsername = (username: string): string =>
  username.trim().toLowerCase();

export const toRoleAssignments = (
  selectedRoles: ReadonlySet<string>
): Array<{ event: string; role: RoleValue }> =>
  Array.from(selectedRoles).map(parseRoleKey);

export const createAccountFormInitialState = (
  username = ""
): AccountFormState => ({
  accountUsername: username,
  errorMessage: null,
  isSubmitting: false,
  password: "",
  passwordConfirm: "",
  selectedRoles: new Set(),
  showPassword: false,
  showPasswordConfirm: false,
  successMessage: null,
});

export const accountFormReducer = (
  state: AccountFormState,
  action: AccountFormAction
): AccountFormState => {
  switch (action.type) {
    case "set":
      return { ...state, ...action.payload };
    case "toggleRole": {
      const nextRoles = new Set(state.selectedRoles);
      if (nextRoles.has(action.key)) {
        nextRoles.delete(action.key);
      } else {
        nextRoles.add(action.key);
      }
      return { ...state, selectedRoles: nextRoles };
    }
    default:
      return state;
  }
};

export const validateAccountFormForSubmit = ({
  mode,
  state,
}: {
  mode: AccountFormMode;
  state: Pick<
    AccountFormState,
    "accountUsername" | "password" | "passwordConfirm" | "selectedRoles"
  >;
}): string | null => {
  if (mode === "manage") {
    if (state.selectedRoles.size === 0) {
      return accountFormErrorMessages.missingRoles;
    }

    const hasPasswordInput =
      state.password.length > 0 || state.passwordConfirm.length > 0;
    if (hasPasswordInput && state.password !== state.passwordConfirm) {
      return accountFormErrorMessages.passwordMismatch;
    }

    return null;
  }

  if (!normalizeAccountUsername(state.accountUsername)) {
    return accountFormErrorMessages.missingUsername;
  }

  if (!(state.password && state.passwordConfirm)) {
    return accountFormErrorMessages.missingPassword;
  }

  if (state.password !== state.passwordConfirm) {
    return accountFormErrorMessages.passwordMismatch;
  }

  if (state.selectedRoles.size === 0) {
    return accountFormErrorMessages.missingRoles;
  }

  return null;
};

export const beginAccountFormSubmit = ({
  event,
  onBeforeValidate,
  setField,
  token,
  validateBeforeSubmit,
}: {
  event: { preventDefault: () => void };
  onBeforeValidate?: () => void;
  setField: (payload: Partial<AccountFormState>) => void;
  token: string | null;
  validateBeforeSubmit: () => string | null;
}): string | null => {
  event.preventDefault();
  setField({
    errorMessage: null,
    successMessage: null,
  });
  onBeforeValidate?.();

  const validationError = validateBeforeSubmit();
  if (validationError) {
    setField({ errorMessage: validationError });
    return null;
  }

  if (!token) {
    setField({ errorMessage: "You must be logged in as an admin user." });
    return null;
  }

  setField({ isSubmitting: true });
  return token;
};

export const useAccountFormController = ({
  events,
  initialUsername = "",
  mode,
}: {
  events: readonly EventItem[];
  initialUsername?: string;
  mode: AccountFormMode;
}) => {
  const [state, dispatch] = useReducer(
    accountFormReducer,
    initialUsername,
    createAccountFormInitialState
  );

  const eventRows = useMemo(() => buildEventRows(events), [events]);

  const handleRoleToggle = (eventCode: string, role: RoleValue): void => {
    dispatch({
      key: roleKey(eventCode, role),
      type: "toggleRole",
    });
  };

  const validateBeforeSubmit = (): string | null =>
    validateAccountFormForSubmit({
      mode,
      state,
    });

  return {
    dispatch,
    eventRows,
    handleRoleToggle,
    state,
    validateBeforeSubmit,
  };
};
