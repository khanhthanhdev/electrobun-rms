import {
  type Dispatch,
  type FormEvent,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import {
  deleteUser,
  getUser,
  updateUser,
} from "../../features/users/services/users-service";
import { LoadingIndicator } from "../../shared/components/loading-indicator";
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

interface ManageUserPageProps {
  events: EventItem[];
  isEventsLoading: boolean;
  token: string | null;
  username: string;
}

interface ManageUserPageState {
  accountUsername: string;
  errorMessage: string | null;
  isDeleteConfirming: boolean;
  isDeleting: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  password: string;
  passwordConfirm: string;
  selectedRoles: Set<string>;
  showPassword: boolean;
  showPasswordConfirm: boolean;
  successMessage: string | null;
}

type ManageUserPageAction =
  | {
      type: "set";
      payload: Partial<ManageUserPageState>;
    }
  | {
      type: "toggleRole";
      key: string;
    };

const createManageUserPageInitialState = (
  username: string
): ManageUserPageState => ({
  isLoading: true,
  isSubmitting: false,
  isDeleting: false,
  isDeleteConfirming: false,
  errorMessage: null,
  successMessage: null,
  accountUsername: username,
  password: "",
  passwordConfirm: "",
  showPassword: false,
  showPasswordConfirm: false,
  selectedRoles: new Set(),
});

const manageUserPageReducer = (
  state: ManageUserPageState,
  action: ManageUserPageAction
): ManageUserPageState => {
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

const getDeleteButtonLabel = ({
  isDeleteConfirming,
  isDeleting,
}: {
  isDeleteConfirming: boolean;
  isDeleting: boolean;
}): string => {
  if (isDeleting) {
    return "Deleting Account...";
  }

  if (isDeleteConfirming) {
    return "Delete Account (Confirm)";
  }

  return "Delete Account";
};

const useManageUserPageController = ({
  events,
  token,
  username,
}: Pick<ManageUserPageProps, "events" | "token" | "username">) => {
  const [state, dispatch] = useReducer(
    manageUserPageReducer,
    username,
    createManageUserPageInitialState
  );

  const eventRows = useMemo(() => buildEventRows(events), [events]);

  useEffect(() => {
    let isCancelled = false;

    if (!token) {
      dispatch({
        type: "set",
        payload: {
          errorMessage: "You must be logged in as an admin user.",
          isLoading: false,
        },
      });
      return;
    }

    dispatch({
      type: "set",
      payload: {
        isLoading: true,
        errorMessage: null,
      },
    });

    getUser(username, token)
      .then((result) => {
        if (isCancelled) {
          return;
        }
        dispatch({
          type: "set",
          payload: {
            accountUsername: result.user.username,
            selectedRoles: new Set(
              result.user.roles.map((assignment) =>
                roleKey(assignment.event, assignment.role)
              )
            ),
            isDeleteConfirming: false,
          },
        });
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }
        dispatch({
          type: "set",
          payload: {
            errorMessage:
              error instanceof Error
                ? error.message
                : "Failed to load user details.",
          },
        });
      })
      .finally(() => {
        if (isCancelled) {
          return;
        }
        dispatch({
          type: "set",
          payload: {
            isLoading: false,
          },
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [token, username]);

  const handleRoleToggle = (eventCode: string, role: RoleValue): void => {
    dispatch({
      type: "toggleRole",
      key: roleKey(eventCode, role),
    });
  };

  const handleUpdate = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();
    dispatch({
      type: "set",
      payload: {
        errorMessage: null,
        successMessage: null,
        isDeleteConfirming: false,
      },
    });

    if (state.selectedRoles.size === 0) {
      dispatch({
        type: "set",
        payload: {
          errorMessage: "Select at least one role assignment.",
        },
      });
      return;
    }

    const hasPasswordInput =
      state.password.length > 0 || state.passwordConfirm.length > 0;
    if (hasPasswordInput && state.password !== state.passwordConfirm) {
      dispatch({
        type: "set",
        payload: {
          errorMessage: "Password and re-enter password must match.",
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

    dispatch({
      type: "set",
      payload: {
        isSubmitting: true,
      },
    });

    try {
      const roles = Array.from(state.selectedRoles).map(parseRoleKey);
      await updateUser(
        state.accountUsername,
        {
          password: state.password,
          passwordConfirm: state.passwordConfirm,
          roles,
        },
        token
      );
      dispatch({
        type: "set",
        payload: {
          password: "",
          passwordConfirm: "",
          successMessage: `Account "${state.accountUsername}" was updated.`,
        },
      });
    } catch (error) {
      dispatch({
        type: "set",
        payload: {
          errorMessage:
            error instanceof Error
              ? error.message
              : "Failed to update account.",
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

  const handleDelete = async (): Promise<void> => {
    dispatch({
      type: "set",
      payload: {
        errorMessage: null,
        successMessage: null,
      },
    });

    if (!token) {
      dispatch({
        type: "set",
        payload: {
          errorMessage: "You must be logged in as an admin user.",
        },
      });
      return;
    }

    if (!state.isDeleteConfirming) {
      dispatch({
        type: "set",
        payload: {
          isDeleteConfirming: true,
          errorMessage: `Click "Delete Account" again to delete "${state.accountUsername}".`,
        },
      });
      return;
    }

    dispatch({
      type: "set",
      payload: {
        isDeleting: true,
      },
    });

    try {
      await deleteUser(state.accountUsername, token);
      window.history.pushState({}, "", "/user/manage");
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (error) {
      dispatch({
        type: "set",
        payload: {
          errorMessage:
            error instanceof Error
              ? error.message
              : "Failed to delete account.",
        },
      });
    } finally {
      dispatch({
        type: "set",
        payload: {
          isDeleting: false,
        },
      });
    }
  };

  return {
    dispatch,
    eventRows,
    handleDelete,
    handleRoleToggle,
    handleUpdate,
    state,
  };
};

interface ManageUserFormProps {
  deleteButtonLabel: string;
  dispatch: Dispatch<ManageUserPageAction>;
  eventRows: readonly string[];
  isEventsLoading: boolean;
  onDelete: () => Promise<void>;
  onRoleToggle: (eventCode: string, role: RoleValue) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  state: ManageUserPageState;
}

const ManageUserForm = ({
  deleteButtonLabel,
  dispatch,
  eventRows,
  isEventsLoading,
  onDelete,
  onRoleToggle,
  onSubmit,
  state,
}: ManageUserFormProps): JSX.Element => (
  <form
    className="card surface-card surface-card--xlarge stack"
    onSubmit={onSubmit}
  >
    <div className="stack">
      <div className="form-row" data-field>
        <label htmlFor="username">Username:</label>
        <input
          disabled
          id="username"
          type="text"
          value={state.accountUsername}
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
        value={state.passwordConfirm}
        visibilityToggleId="showPasswordConfirm"
      />

      <RoleMatrix
        eventRows={eventRows}
        isEventsLoading={isEventsLoading}
        onRoleToggle={onRoleToggle}
        selectedRoles={state.selectedRoles}
      />

      <StatusMessages
        errorMessage={state.errorMessage}
        successMessage={state.successMessage}
      />

      <div className="form-actions form-actions--between">
        <button disabled={state.isDeleting || state.isSubmitting} type="submit">
          {state.isSubmitting ? "Updating Account..." : "Update Account"}
        </button>
        <button
          data-variant="danger"
          disabled={state.isDeleting || state.isSubmitting}
          onClick={onDelete}
          type="button"
        >
          {deleteButtonLabel}
        </button>
      </div>
    </div>
  </form>
);

export const ManageUserPage = ({
  events,
  isEventsLoading,
  token,
  username,
}: ManageUserPageProps): JSX.Element => {
  const {
    dispatch,
    eventRows,
    handleDelete,
    handleRoleToggle,
    handleUpdate,
    state,
  } = useManageUserPageController({
    events,
    token,
    username,
  });

  if (state.isLoading) {
    return (
      <main className="page-shell page-shell--center">
        <LoadingIndicator />
      </main>
    );
  }

  if (state.errorMessage && state.selectedRoles.size === 0) {
    return (
      <main className="page-shell page-shell--center">
        <div className="card surface-card surface-card--small stack stack--compact">
          <p className="message-block" data-variant="danger" role="alert">
            {state.errorMessage}
          </p>
        </div>
      </main>
    );
  }

  const deleteButtonLabel = getDeleteButtonLabel({
    isDeleteConfirming: state.isDeleteConfirming,
    isDeleting: state.isDeleting,
  });

  return (
    <main className="page-shell page-shell--top">
      <ManageUserForm
        deleteButtonLabel={deleteButtonLabel}
        dispatch={dispatch}
        eventRows={eventRows}
        isEventsLoading={isEventsLoading}
        onDelete={handleDelete}
        onRoleToggle={handleRoleToggle}
        onSubmit={handleUpdate}
        state={state}
      />
    </main>
  );
};
