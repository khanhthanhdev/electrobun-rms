import { type Dispatch, type FormEvent, useMemo, useReducer } from "react";
import { createUserAccount } from "../../features/users/services/users-service";
import type { RoleValue } from "../../shared/constants/roles";
import type { EventItem } from "../../shared/types/event";
import {
  buildEventRows,
  PasswordField,
  parseRoleKey,
  RoleMatrix,
  roleKey,
  StatusMessages,
} from "./account-form-sections";

interface CreateAccountPageProps {
  events: EventItem[];
  isEventsLoading: boolean;
  token: string | null;
}

interface CreateAccountPageState {
  errorMessage: string | null;
  isSubmitting: boolean;
  password: string;
  passwordConfirm: string;
  selectedRoles: Set<string>;
  showPassword: boolean;
  showPasswordConfirm: boolean;
  successMessage: string | null;
  username: string;
}

type CreateAccountPageAction =
  | {
      type: "set";
      payload: Partial<CreateAccountPageState>;
    }
  | {
      type: "toggleRole";
      key: string;
    };

const createAccountPageInitialState: CreateAccountPageState = {
  username: "",
  password: "",
  passwordConfirm: "",
  showPassword: false,
  showPasswordConfirm: false,
  selectedRoles: new Set(),
  isSubmitting: false,
  errorMessage: null,
  successMessage: null,
};

const createAccountPageReducer = (
  state: CreateAccountPageState,
  action: CreateAccountPageAction
): CreateAccountPageState => {
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

const useCreateAccountPageController = ({
  events,
  token,
}: Pick<CreateAccountPageProps, "events" | "token">) => {
  const [state, dispatch] = useReducer(
    createAccountPageReducer,
    createAccountPageInitialState
  );

  const eventRows = useMemo(() => buildEventRows(events), [events]);

  const handleRoleToggle = (eventCode: string, role: RoleValue): void => {
    dispatch({
      type: "toggleRole",
      key: roleKey(eventCode, role),
    });
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();
    dispatch({
      type: "set",
      payload: {
        errorMessage: null,
        successMessage: null,
      },
    });

    const normalizedUsername = state.username.trim().toLowerCase();
    if (!normalizedUsername) {
      dispatch({
        type: "set",
        payload: {
          errorMessage: "Username is required.",
        },
      });
      return;
    }

    if (!(state.password && state.passwordConfirm)) {
      dispatch({
        type: "set",
        payload: {
          errorMessage: "Password and re-enter password are required.",
        },
      });
      return;
    }

    if (state.password !== state.passwordConfirm) {
      dispatch({
        type: "set",
        payload: {
          errorMessage: "Password and re-enter password must match.",
        },
      });
      return;
    }

    if (state.selectedRoles.size === 0) {
      dispatch({
        type: "set",
        payload: {
          errorMessage: "Select at least one role assignment.",
        },
      });
      return;
    }

    if (!token) {
      dispatch({
        type: "set",
        payload: {
          errorMessage: "You must be logged in as an admin user.",
        },
      });
      return;
    }

    const payloadRoles = Array.from(state.selectedRoles).map(parseRoleKey);

    dispatch({
      type: "set",
      payload: {
        isSubmitting: true,
      },
    });

    try {
      const result = await createUserAccount(
        {
          username: normalizedUsername,
          password: state.password,
          passwordConfirm: state.passwordConfirm,
          roles: payloadRoles,
        },
        token
      );

      dispatch({
        type: "set",
        payload: {
          successMessage: `Account "${result.user.username}" was created.`,
          username: "",
          password: "",
          passwordConfirm: "",
          selectedRoles: new Set(),
        },
      });
    } catch (error) {
      dispatch({
        type: "set",
        payload: {
          errorMessage:
            error instanceof Error
              ? error.message
              : "Failed to create account.",
        },
      });
    } finally {
      dispatch({
        type: "set",
        payload: {
          isSubmitting: false,
        },
      });
    }
  };

  return {
    dispatch,
    eventRows,
    handleRoleToggle,
    handleSubmit,
    state,
  };
};

interface CreateAccountFormProps {
  dispatch: Dispatch<CreateAccountPageAction>;
  eventRows: readonly string[];
  hasEvents: boolean;
  isEventsLoading: boolean;
  onRoleToggle: (eventCode: string, role: RoleValue) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  state: CreateAccountPageState;
}

const CreateAccountForm = ({
  dispatch,
  eventRows,
  hasEvents,
  isEventsLoading,
  onRoleToggle,
  onSubmit,
  state,
}: CreateAccountFormProps): JSX.Element => (
  <form
    className="card surface-card surface-card--xlarge stack"
    onSubmit={onSubmit}
  >
    <div className="stack">
      <div className="form-row" data-field>
        <label htmlFor="username">Username:</label>
        <input
          id="username"
          onChange={(nextEvent) => {
            dispatch({
              type: "set",
              payload: {
                username: nextEvent.target.value,
              },
            });
          }}
          placeholder="Enter username"
          required
          type="text"
          value={state.username}
        />
      </div>

      <PasswordField
        id="password"
        isVisible={state.showPassword}
        label="Password:"
        onValueChange={(value) => {
          dispatch({
            type: "set",
            payload: {
              password: value,
            },
          });
        }}
        onVisibilityChange={(checked) => {
          dispatch({
            type: "set",
            payload: {
              showPassword: checked,
            },
          });
        }}
        placeholder="Password"
        required
        value={state.password}
        visibilityToggleId="showPassword"
      />

      <PasswordField
        id="passwordConfirm"
        isVisible={state.showPasswordConfirm}
        label="Re-enter Password:"
        onValueChange={(value) => {
          dispatch({
            type: "set",
            payload: {
              passwordConfirm: value,
            },
          });
        }}
        onVisibilityChange={(checked) => {
          dispatch({
            type: "set",
            payload: {
              showPasswordConfirm: checked,
            },
          });
        }}
        placeholder="Re-enter Password"
        required
        value={state.passwordConfirm}
        visibilityToggleId="showPasswordConfirm"
      />

      <RoleMatrix
        eventRows={eventRows}
        isEventsLoading={isEventsLoading}
        onRoleToggle={onRoleToggle}
        selectedRoles={state.selectedRoles}
      />

      {isEventsLoading || hasEvents ? null : (
        <p className="form-note">
          No event-specific rows available yet. You can still assign roles in
          "All Events".
        </p>
      )}

      <StatusMessages
        errorMessage={state.errorMessage}
        successMessage={state.successMessage}
      />

      <div>
        <button disabled={state.isSubmitting || isEventsLoading} type="submit">
          {state.isSubmitting ? "Creating Account..." : "Create Account"}
        </button>
      </div>
    </div>
  </form>
);

export const CreateAccountPage = ({
  events,
  isEventsLoading,
  token,
}: CreateAccountPageProps): JSX.Element => {
  const { dispatch, eventRows, handleRoleToggle, handleSubmit, state } =
    useCreateAccountPageController({
      events,
      token,
    });

  const hasEvents = eventRows.length > 1;

  return (
    <main className="page-shell page-shell--top">
      <CreateAccountForm
        dispatch={dispatch}
        eventRows={eventRows}
        hasEvents={hasEvents}
        isEventsLoading={isEventsLoading}
        onRoleToggle={handleRoleToggle}
        onSubmit={handleSubmit}
        state={state}
      />
    </main>
  );
};
