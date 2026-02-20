import { useEffect, useState } from "react";
import type { DefaultAccountInfo } from "../features/events/services/manual-event-service";
import { fetchDefaultAccounts } from "../features/events/services/manual-event-service";
import { LoadingIndicator } from "../shared/components/loading-indicator";

interface DefaultAccountsPageProps {
  eventCode: string;
  token: string | null;
}

export const DefaultAccountsPage = ({
  eventCode,
  token,
}: DefaultAccountsPageProps): JSX.Element => {
  const [accounts, setAccounts] = useState<DefaultAccountInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    if (!token) {
      setErrorMessage("You must be logged in to view this page.");
      setIsLoading(false);
      return;
    }

    fetchDefaultAccounts(eventCode, token)
      .then((result) => {
        if (!isCancelled) {
          setAccounts(result.accounts);
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Failed to load default accounts."
          );
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [eventCode, token]);

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

        {accounts.length === 0 ? (
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
                {accounts.map((account) => (
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

        <div>
          <a className="button" href="/">
            Back to Home
          </a>
        </div>
      </div>
    </main>
  );
};
