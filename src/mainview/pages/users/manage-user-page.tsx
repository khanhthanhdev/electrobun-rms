import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  deleteUser,
  getUser,
  updateUser,
} from "../../features/users/services/users-service";
import { LoadingIndicator } from "../../shared/components/loading-indicator";
import {
  CREATE_ACCOUNT_ROLE_COLUMNS,
  type RoleValue,
} from "../../shared/constants/roles";
import type { EventItem } from "../../shared/types/event";

interface ManageUserPageProps {
  events: EventItem[];
  isEventsLoading: boolean;
  token: string | null;
  username: string;
}

const ALL_EVENTS_CODE = "*" as const;

function roleKey(eventCode: string, role: RoleValue): string {
  return `${eventCode}:${role}`;
}

function parseRoleKey(value: string): { event: string; role: RoleValue } {
  const [event, role] = value.split(":", 2);
  return {
    event,
    role: role as RoleValue,
  };
}

export const ManageUserPage = ({
  events,
  isEventsLoading,
  token,
  username,
}: ManageUserPageProps): JSX.Element => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [accountUsername, setAccountUsername] = useState(username);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());

  const eventRows = useMemo(() => {
    const dedupedCodes = Array.from(new Set(events.map((event) => event.code)));
    return [ALL_EVENTS_CODE, ...dedupedCodes];
  }, [events]);

  useEffect(() => {
    let isCancelled = false;

    if (!token) {
      setErrorMessage("You must be logged in as an admin user.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    getUser(username, token)
      .then((result) => {
        if (isCancelled) {
          return;
        }
        setAccountUsername(result.user.username);
        setSelectedRoles(
          new Set(
            result.user.roles.map((assignment) =>
              roleKey(assignment.event, assignment.role)
            )
          )
        );
        setIsDeleteConfirming(false);
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load user details."
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
  }, [token, username]);

  const handleRoleToggle = (eventCode: string, role: RoleValue): void => {
    const key = roleKey(eventCode, role);
    setSelectedRoles((currentRoles) => {
      const nextRoles = new Set(currentRoles);
      if (nextRoles.has(key)) {
        nextRoles.delete(key);
      } else {
        nextRoles.add(key);
      }
      return nextRoles;
    });
  };

  const handleUpdate = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsDeleteConfirming(false);

    if (selectedRoles.size === 0) {
      setErrorMessage("Select at least one role assignment.");
      return;
    }

    const hasPasswordInput = password.length > 0 || passwordConfirm.length > 0;
    if (hasPasswordInput && password !== passwordConfirm) {
      setErrorMessage("Password and re-enter password must match.");
      return;
    }

    if (!token) {
      setErrorMessage("You must be logged in as an admin user.");
      return;
    }

    setIsSubmitting(true);
    try {
      const roles = Array.from(selectedRoles).map(parseRoleKey);
      await updateUser(
        accountUsername,
        {
          password,
          passwordConfirm,
          roles,
        },
        token
      );
      setPassword("");
      setPasswordConfirm("");
      setSuccessMessage(`Account "${accountUsername}" was updated.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to update account."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!token) {
      setErrorMessage("You must be logged in as an admin user.");
      return;
    }

    if (!isDeleteConfirming) {
      setIsDeleteConfirming(true);
      setErrorMessage(
        `Click "Delete Account" again to delete "${accountUsername}".`
      );
      return;
    }

    setIsDeleting(true);
    try {
      await deleteUser(accountUsername, token);
      window.history.pushState({}, "", "/user/manage");
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to delete account."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="page-shell page-shell--center">
        <LoadingIndicator />
      </main>
    );
  }

  if (errorMessage && selectedRoles.size === 0) {
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

  let deleteButtonLabel = "Delete Account";
  if (isDeleteConfirming) {
    deleteButtonLabel = "Delete Account (Confirm)";
  }
  if (isDeleting) {
    deleteButtonLabel = "Deleting Account...";
  }

  return (
    <main className="page-shell page-shell--top">
      <form
        className="card surface-card surface-card--xlarge stack"
        onSubmit={handleUpdate}
      >
        <div className="stack">
          <div className="form-row" data-field>
            <label htmlFor="username">Username:</label>
            <input disabled id="username" type="text" value={accountUsername} />
          </div>

          <div className="form-row" data-field>
            <label htmlFor="password">Password:</label>
            <input
              id="password"
              onChange={(nextEvent) => {
                setPassword(nextEvent.target.value);
              }}
              placeholder="Password"
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <label className="form-checkbox" htmlFor="showPassword">
              <input
                checked={showPassword}
                id="showPassword"
                onChange={(nextEvent) => {
                  setShowPassword(nextEvent.target.checked);
                }}
                type="checkbox"
              />
              Show Password
            </label>
          </div>

          <div className="form-row" data-field>
            <label htmlFor="passwordConfirm">Re-enter Password:</label>
            <input
              id="passwordConfirm"
              onChange={(nextEvent) => {
                setPasswordConfirm(nextEvent.target.value);
              }}
              placeholder="Re-enter Password"
              type={showPasswordConfirm ? "text" : "password"}
              value={passwordConfirm}
            />
            <label className="form-checkbox" htmlFor="showPasswordConfirm">
              <input
                checked={showPasswordConfirm}
                id="showPasswordConfirm"
                onChange={(nextEvent) => {
                  setShowPasswordConfirm(nextEvent.target.checked);
                }}
                type="checkbox"
              />
              Show Password
            </label>
          </div>

          <div>
            <p className="form-section-label">Roles:</p>
            <p className="form-description">
              You should independently verify that this user has completed all
              of the required training for the selected roles.
            </p>
          </div>

          <div className="table-wrap">
            <table className="table-role-matrix">
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  {CREATE_ACCOUNT_ROLE_COLUMNS.map((column) => (
                    <th key={column.value} scope="col">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isEventsLoading ? (
                  <tr>
                    <td colSpan={CREATE_ACCOUNT_ROLE_COLUMNS.length + 1}>
                      <LoadingIndicator />
                    </td>
                  </tr>
                ) : (
                  eventRows.map((eventCode) => (
                    <tr key={eventCode}>
                      <td>
                        {eventCode === ALL_EVENTS_CODE
                          ? "All Events"
                          : eventCode}
                      </td>
                      {CREATE_ACCOUNT_ROLE_COLUMNS.map((column) => (
                        <td key={`${eventCode}-${column.value}`}>
                          <label htmlFor={`${eventCode}-${column.value}`}>
                            <input
                              checked={selectedRoles.has(
                                roleKey(eventCode, column.value)
                              )}
                              id={`${eventCode}-${column.value}`}
                              onChange={() => {
                                handleRoleToggle(eventCode, column.value);
                              }}
                              type="checkbox"
                            />
                            <span className="sr-only">
                              {eventCode === ALL_EVENTS_CODE
                                ? `All events ${column.label}`
                                : `${eventCode} ${column.label}`}
                            </span>
                          </label>
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {errorMessage ? (
            <p className="message-block" data-variant="danger" role="alert">
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? (
            <p className="message-block" data-variant="success" role="alert">
              {successMessage}
            </p>
          ) : null}

          <div className="form-actions form-actions--between">
            <button disabled={isDeleting || isSubmitting} type="submit">
              {isSubmitting ? "Updating Account..." : "Update Account"}
            </button>
            <button
              data-variant="danger"
              disabled={isDeleting || isSubmitting}
              onClick={async () => {
                await handleDelete();
              }}
              type="button"
            >
              {deleteButtonLabel}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
};
