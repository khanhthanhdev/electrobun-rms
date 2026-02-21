import { useEffect, useState } from "react";
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

export const ManageUsersPage = ({
  token,
}: ManageUsersPageProps): JSX.Element => {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [printErrorMessage, setPrintErrorMessage] = useState<string | null>(
    null
  );
  const [users, setUsers] = useState<ManagedUserItem[]>([]);

  useEffect(() => {
    let isCancelled = false;

    if (!token) {
      setErrorMessage("You must be logged in as an admin user.");
      setIsLoading(false);
      return;
    }

    listUsers(token)
      .then((result) => {
        if (isCancelled) {
          return;
        }
        setUsers(result.users);
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load users."
        );
      })
      .finally(() => {
        if (isCancelled) {
          return;
        }
        setIsLoading(false);
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
    setPrintErrorMessage(null);

    try {
      printTable<ManagedUserItem>({
        destination,
        generatedAt: new Date().toISOString(),
        title: "User Accounts",
        subtitle: "Managed users list",
        rows: users,
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
      setPrintErrorMessage(
        error instanceof Error ? error.message : "Failed to open print dialog."
      );
    }
  };

  if (isLoading) {
    return (
      <main className="page-shell page-shell--center">
        <LoadingIndicator />
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main className="page-shell page-shell--center">
        <div className="card surface-card surface-card--small stack stack--compact">
          <p className="message-block" data-variant="danger" role="alert">
            {errorMessage}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell page-shell--top">
      <section className="card surface-card surface-card--large stack stack--compact">
        <h2 className="app-heading app-heading--center">Accounts</h2>

        {printErrorMessage ? (
          <p className="message-block" data-variant="danger" role="alert">
            {printErrorMessage}
          </p>
        ) : null}

        {users.length === 0 ? (
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
                {users.map((user) => (
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
