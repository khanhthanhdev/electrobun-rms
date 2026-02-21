import { type FormEvent, useMemo, useState } from "react";
import { createUserAccount } from "../../features/users/services/users-service";
import { LoadingIndicator } from "../../shared/components/loading-indicator";
import {
  CREATE_ACCOUNT_ROLE_COLUMNS,
  type RoleValue,
} from "../../shared/constants/roles";
import type { EventItem } from "../../shared/types/event";

interface CreateAccountPageProps {
  events: EventItem[];
  isEventsLoading: boolean;
  token: string | null;
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

export const CreateAccountPage = ({
  events,
  isEventsLoading,
  token,
}: CreateAccountPageProps): JSX.Element => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const eventRows = useMemo(() => {
    const dedupedCodes = Array.from(new Set(events.map((event) => event.code)));
    return [ALL_EVENTS_CODE, ...dedupedCodes];
  }, [events]);

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

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const normalizedUsername = username.trim().toLowerCase();
    if (!normalizedUsername) {
      setErrorMessage("Username is required.");
      return;
    }

    if (!(password && passwordConfirm)) {
      setErrorMessage("Password and re-enter password are required.");
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMessage("Password and re-enter password must match.");
      return;
    }

    if (selectedRoles.size === 0) {
      setErrorMessage("Select at least one role assignment.");
      return;
    }

    if (!token) {
      setErrorMessage("You must be logged in as an admin user.");
      return;
    }

    const payloadRoles = Array.from(selectedRoles).map(parseRoleKey);

    setIsSubmitting(true);
    try {
      const result = await createUserAccount(
        {
          username: normalizedUsername,
          password,
          passwordConfirm,
          roles: payloadRoles,
        },
        token
      );

      setSuccessMessage(`Account "${result.user.username}" was created.`);
      setUsername("");
      setPassword("");
      setPasswordConfirm("");
      setSelectedRoles(new Set());
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to create account."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasEvents = eventRows.length > 1;

  return (
    <main className="page-shell page-shell--top">
      <form
        className="card surface-card surface-card--xlarge stack"
        onSubmit={handleSubmit}
      >
        <div className="stack">
          <div className="form-row" data-field>
            <label htmlFor="username">Username:</label>
            <input
              id="username"
              onChange={(nextEvent) => {
                setUsername(nextEvent.target.value);
              }}
              placeholder="Enter username"
              required
              type="text"
              value={username}
            />
          </div>

          <div className="form-row" data-field>
            <label htmlFor="password">Password:</label>
            <input
              id="password"
              onChange={(nextEvent) => {
                setPassword(nextEvent.target.value);
              }}
              placeholder="Password"
              required
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
              required
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

          {isEventsLoading || hasEvents ? null : (
            <p className="form-note">
              No event-specific rows available yet. You can still assign roles
              in "All Events".
            </p>
          )}

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

          <div>
            <button disabled={isSubmitting || isEventsLoading} type="submit">
              {isSubmitting ? "Creating Account..." : "Create Account"}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
};
