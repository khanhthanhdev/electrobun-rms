import { useEffect, useReducer } from "react";
import {
  listUsers,
  type ManagedUserItem,
} from "../../features/users/services/users-service";
import { LoadingIndicator } from "../../shared/components/loading-indicator";
import {
  type PrintDestination,
  printTable,
} from "../../shared/services/print-service";

interface ManageUsersPageProps {
  token: string | null;
}

interface ManageUsersPageState {
  errorMessage: string | null;
  isLoading: boolean;
  printErrorMessage: string | null;
  users: ManagedUserItem[];
}

interface ManageUsersPageAction {
  payload: Partial<ManageUsersPageState>;
  type: "set";
}

const manageUsersPageInitialState: ManageUsersPageState = {
  isLoading: true,
  errorMessage: null,
  printErrorMessage: null,
  users: [],
};

const manageUsersPageReducer = (
  state: ManageUsersPageState,
  action: ManageUsersPageAction
): ManageUsersPageState => {
  switch (action.type) {
    case "set":
      return { ...state, ...action.payload };
    default:
      return state;
  }
};

export const ManageUsersPage = ({
  token,
}: ManageUsersPageProps): JSX.Element => {
  const [state, dispatch] = useReducer(
    manageUsersPageReducer,
    manageUsersPageInitialState
  );

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

    listUsers(token)
      .then((result) => {
        if (isCancelled) {
          return;
        }
        dispatch({
          type: "set",
          payload: {
            users: result.users,
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
              error instanceof Error ? error.message : "Failed to load users.",
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
  }, [token]);

  const goToUser = (username: string): void => {
    window.history.pushState(
      {},
      "",
      `/user/manage/${encodeURIComponent(username)}`
    );
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const handlePrintUsers = (destination: PrintDestination): void => {
    dispatch({
      type: "set",
      payload: {
        printErrorMessage: null,
      },
    });

    try {
      printTable<ManagedUserItem>({
        destination,
        generatedAt: new Date().toISOString(),
        title: "User Accounts",
        subtitle: "Managed users list",
        rows: state.users,
        emptyMessage: "No users found.",
        columns: [
          { header: "Username", formatValue: (row) => row.username },
          { header: "Type", formatValue: (row) => String(row.type) },
          {
            header: "Generic",
            formatValue: (row) => (row.generic ? "Yes" : "No"),
          },
          { header: "Used", formatValue: (row) => (row.used ? "Yes" : "No") },
        ],
      });
    } catch (error) {
      dispatch({
        type: "set",
        payload: {
          printErrorMessage:
            error instanceof Error
              ? error.message
              : "Failed to open print dialog.",
        },
      });
    }
  };

  if (state.isLoading) {
    return (
      <main className="page-shell page-shell--center">
        <LoadingIndicator />
      </main>
    );
  }

  if (state.errorMessage) {
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

  return (
    <main className="page-shell page-shell--top">
      <section className="card surface-card surface-card--large stack stack--compact">
        <h2 className="app-heading app-heading--center">Accounts</h2>

        {state.printErrorMessage ? (
          <p className="message-block" data-variant="danger" role="alert">
            {state.printErrorMessage}
          </p>
        ) : null}

        {state.users.length === 0 ? (
          <p className="form-note form-note--spaced">No users found.</p>
        ) : (
          <div className="table-wrap">
            <table className="table-users">
              <thead>
                <tr>
                  <th scope="col">Username</th>
                  <th className="table-action-cell" scope="col">
                    Manage
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.users.map((user) => (
                  <tr key={user.username}>
                    <td>{user.username}</td>
                    <td className="table-action-cell">
                      <button
                        className="small"
                        onClick={() => {
                          goToUser(user.username);
                        }}
                        type="button"
                      >
                        Manage User
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="form-actions">
          <button
            data-variant="secondary"
            onClick={() => {
              handlePrintUsers("paper");
            }}
            type="button"
          >
            Print Accounts (Paper)
          </button>
          <button
            onClick={() => {
              handlePrintUsers("pdf");
            }}
            type="button"
          >
            Export Accounts (PDF)
          </button>
        </div>
      </section>
    </main>
  );
};
