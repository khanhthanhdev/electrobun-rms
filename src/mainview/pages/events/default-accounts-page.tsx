import { useEffect, useReducer } from "react";
import type { DefaultAccountInfo } from "../../features/events/services/manual-event-service";
import {
  fetchDefaultAccounts,
  regenerateDefaultAccounts,
} from "../../features/events/services/manual-event-service";
import { LoadingIndicator } from "../../shared/components/loading-indicator";

interface DefaultAccountsPageProps {
  eventCode: string;
  token: string | null;
}

interface DefaultAccountsState {
  accounts: DefaultAccountInfo[];
  actionErrorMessage: string | null;
  isLoading: boolean;
  isRegenerateConfirming: boolean;
  isRegenerating: boolean;
  loadErrorMessage: string | null;
  successMessage: string | null;
}

interface DefaultAccountsAction {
  payload: Partial<DefaultAccountsState>;
  type: "set";
}

const defaultAccountsInitialState: DefaultAccountsState = {
  accounts: [],
  isLoading: true,
  isRegenerateConfirming: false,
  isRegenerating: false,
  loadErrorMessage: null,
  actionErrorMessage: null,
  successMessage: null,
};

const defaultAccountsReducer = (
  state: DefaultAccountsState,
  action: DefaultAccountsAction
): DefaultAccountsState => {
  switch (action.type) {
    case "set":
      return { ...state, ...action.payload };
    default:
      return state;
  }
};

export const DefaultAccountsPage = ({
  eventCode,
  token,
}: DefaultAccountsPageProps): JSX.Element => {
  const [state, dispatch] = useReducer(
    defaultAccountsReducer,
    defaultAccountsInitialState
  );

  useEffect(() => {
    let isCancelled = false;

    if (!token) {
      dispatch({
        type: "set",
        payload: {
          loadErrorMessage: "You must be logged in to view this page.",
          isLoading: false,
        },
      });
      return;
    }

    dispatch({
      type: "set",
      payload: {
        loadErrorMessage: null,
      },
    });

    fetchDefaultAccounts(eventCode, token)
      .then((result) => {
        if (!isCancelled) {
          dispatch({
            type: "set",
            payload: {
              accounts: result.accounts,
            },
          });
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          dispatch({
            type: "set",
            payload: {
              loadErrorMessage:
                error instanceof Error
                  ? error.message
                  : "Failed to load default accounts.",
            },
          });
        }
      })
      .finally(() => {
        if (!isCancelled) {
          dispatch({
            type: "set",
            payload: {
              isLoading: false,
            },
          });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [eventCode, token]);

  const handleRegenerate = async (): Promise<void> => {
    if (!token) {
      dispatch({
        type: "set",
        payload: {
          actionErrorMessage: "You must be logged in to regenerate accounts.",
        },
      });
      return;
    }

    if (!state.isRegenerateConfirming) {
      dispatch({
        type: "set",
        payload: {
          isRegenerateConfirming: true,
          actionErrorMessage: null,
          successMessage: null,
        },
      });
      return;
    }

    dispatch({
      type: "set",
      payload: {
        isRegenerating: true,
        isRegenerateConfirming: false,
        actionErrorMessage: null,
        successMessage: null,
      },
    });

    try {
      const result = await regenerateDefaultAccounts(eventCode, token);
      dispatch({
        type: "set",
        payload: {
          accounts: result.accounts,
          successMessage: `Regenerated ${result.accounts.length} default accounts for "${eventCode}".`,
        },
      });
    } catch (error) {
      dispatch({
        type: "set",
        payload: {
          actionErrorMessage:
            error instanceof Error
              ? error.message
              : "Failed to regenerate default accounts.",
        },
      });
    } finally {
      dispatch({
        type: "set",
        payload: {
          isRegenerating: false,
        },
      });
    }
  };

  const handleCancelRegenerate = (): void => {
    dispatch({
      type: "set",
      payload: {
        isRegenerateConfirming: false,
        actionErrorMessage: null,
      },
    });
  };

  let regenerateButtonLabel = "Regenerate Default Accounts";
  if (state.isRegenerateConfirming) {
    regenerateButtonLabel = "Regenerate Accounts (Confirm)";
  }
  if (state.isRegenerating) {
    regenerateButtonLabel = "Regenerating Accounts...";
  }

  if (state.isLoading) {
    return (
      <main className="page-shell page-shell--center">
        <LoadingIndicator />
      </main>
    );
  }

  if (state.loadErrorMessage) {
    return (
      <main className="page-shell page-shell--center">
        <div className="card surface-card surface-card--small stack stack--compact">
          <p className="message-block" data-variant="danger" role="alert">
            {state.loadErrorMessage}
          </p>
          <a className="app-link-inline" href="/">
            Back to Home
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell page-shell--top">
      <div className="card surface-card surface-card--medium stack stack--compact">
        <header>
          <h2 className="app-heading">Default Accounts - {eventCode}</h2>
          <p className="app-subheading">
            Generated credentials for this event.
          </p>
        </header>

        {state.actionErrorMessage ? (
          <p className="message-block" data-variant="danger" role="alert">
            {state.actionErrorMessage}
          </p>
        ) : null}

        {state.successMessage ? (
          <output className="message-block" data-variant="success">
            {state.successMessage}
          </output>
        ) : null}

        <p className="form-note">
          Regenerating removes every current account assigned to this event and
          creates a fresh default set with new passwords.
        </p>

        {state.isRegenerateConfirming ? (
          <p className="form-note" data-variant="danger">
            Click <strong>Regenerate Accounts (Confirm)</strong> to continue, or
            cancel.
          </p>
        ) : null}

        {state.accounts.length === 0 ? (
          <p className="form-note">No default accounts found for this event.</p>
        ) : (
          <div className="table-wrap">
            <table className="table-credentials">
              <thead>
                <tr>
                  <th scope="col">Username</th>
                  <th scope="col">Role</th>
                  <th scope="col">Password</th>
                </tr>
              </thead>
              <tbody>
                {state.accounts.map((account) => (
                  <tr key={account.username}>
                    <td>{account.username}</td>
                    <td>{account.role}</td>
                    <td>{account.password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="form-actions">
          <button
            data-variant="danger"
            disabled={state.isRegenerating}
            onClick={handleRegenerate}
            type="button"
          >
            {regenerateButtonLabel}
          </button>
          {state.isRegenerateConfirming && !state.isRegenerating ? (
            <button
              data-variant="secondary"
              onClick={handleCancelRegenerate}
              type="button"
            >
              Cancel
            </button>
          ) : null}
          <a className="button" href="/">
            Back to Home
          </a>
        </div>
      </div>
    </main>
  );
};
