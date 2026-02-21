import { useEffect, useState } from "react";
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

export const DefaultAccountsPage = ({
  eventCode,
  token,
}: DefaultAccountsPageProps): JSX.Element => {
  const [accounts, setAccounts] = useState<DefaultAccountInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerateConfirming, setIsRegenerateConfirming] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(
    null
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    if (!token) {
      setLoadErrorMessage("You must be logged in to view this page.");
      setIsLoading(false);
      return;
    }

    setLoadErrorMessage(null);

    fetchDefaultAccounts(eventCode, token)
      .then((result) => {
        if (!isCancelled) {
          setAccounts(result.accounts);
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setLoadErrorMessage(
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

  const handleRegenerate = async (): Promise<void> => {
    if (!token) {
      setActionErrorMessage("You must be logged in to regenerate accounts.");
      return;
    }

    if (!isRegenerateConfirming) {
      setIsRegenerateConfirming(true);
      setActionErrorMessage(null);
      setSuccessMessage(null);
      return;
    }

    setIsRegenerating(true);
    setIsRegenerateConfirming(false);
    setActionErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await regenerateDefaultAccounts(eventCode, token);
      setAccounts(result.accounts);
      setSuccessMessage(
        `Regenerated ${result.accounts.length} default accounts for "${eventCode}".`
      );
    } catch (error) {
      setActionErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to regenerate default accounts."
      );
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCancelRegenerate = (): void => {
    setIsRegenerateConfirming(false);
    setActionErrorMessage(null);
  };

  let regenerateButtonLabel = "Regenerate Default Accounts";
  if (isRegenerateConfirming) {
    regenerateButtonLabel = "Regenerate Accounts (Confirm)";
  }
  if (isRegenerating) {
    regenerateButtonLabel = "Regenerating Accounts...";
  }

  if (isLoading) {
    return (
      <main className="page-shell page-shell--center">
        <LoadingIndicator />
      </main>
    );
  }

  if (loadErrorMessage) {
    return (
      <main className="page-shell page-shell--center">
        <div className="card surface-card surface-card--small stack stack--compact">
          <p className="message-block" data-variant="danger" role="alert">
            {loadErrorMessage}
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

        {actionErrorMessage ? (
          <p className="message-block" data-variant="danger" role="alert">
            {actionErrorMessage}
          </p>
        ) : null}

        {successMessage ? (
          <output className="message-block" data-variant="success">
            {successMessage}
          </output>
        ) : null}

        <p className="form-note">
          Regenerating removes every current account assigned to this event and
          creates a fresh default set with new passwords.
        </p>

        {isRegenerateConfirming ? (
          <p className="form-note" data-variant="danger">
            Click <strong>Regenerate Accounts (Confirm)</strong> to continue, or
            cancel.
          </p>
        ) : null}

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

        <div className="form-actions">
          <button
            data-variant="danger"
            disabled={isRegenerating}
            onClick={handleRegenerate}
            type="button"
          >
            {regenerateButtonLabel}
          </button>
          {isRegenerateConfirming && !isRegenerating ? (
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
