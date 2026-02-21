import { LoadingIndicator } from "../../shared/components/loading-indicator";
import {
  CREATE_ACCOUNT_ROLE_COLUMNS,
  type RoleValue,
} from "../../shared/constants/roles";
import type { EventItem } from "../../shared/types/event";

export const ALL_EVENTS_CODE = "*" as const;

export function roleKey(eventCode: string, role: RoleValue): string {
  return `${eventCode}:${role}`;
}

export function parseRoleKey(value: string): {
  event: string;
  role: RoleValue;
} {
  const [event, role] = value.split(":", 2);
  return {
    event,
    role: role as RoleValue,
  };
}

export function buildEventRows(events: readonly EventItem[]): string[] {
  const dedupedCodes = Array.from(new Set(events.map((event) => event.code)));
  return [ALL_EVENTS_CODE, ...dedupedCodes];
}

interface PasswordFieldProps {
  id: string;
  isVisible: boolean;
  label: string;
  onValueChange: (value: string) => void;
  onVisibilityChange: (checked: boolean) => void;
  placeholder: string;
  required?: boolean;
  value: string;
  visibilityToggleId: string;
}

export const PasswordField = ({
  id,
  isVisible,
  label,
  onValueChange,
  onVisibilityChange,
  placeholder,
  required = false,
  value,
  visibilityToggleId,
}: PasswordFieldProps): JSX.Element => (
  <div className="form-row" data-field>
    <label htmlFor={id}>{label}</label>
    <input
      id={id}
      onChange={(nextEvent) => {
        onValueChange(nextEvent.target.value);
      }}
      placeholder={placeholder}
      required={required}
      type={isVisible ? "text" : "password"}
      value={value}
    />
    <label className="form-checkbox" htmlFor={visibilityToggleId}>
      <input
        checked={isVisible}
        id={visibilityToggleId}
        onChange={(nextEvent) => {
          onVisibilityChange(nextEvent.target.checked);
        }}
        type="checkbox"
      />
      Show Password
    </label>
  </div>
);

interface RoleMatrixProps {
  eventRows: readonly string[];
  isEventsLoading: boolean;
  onRoleToggle: (eventCode: string, role: RoleValue) => void;
  selectedRoles: ReadonlySet<string>;
}

export const RoleMatrix = ({
  eventRows,
  isEventsLoading,
  onRoleToggle,
  selectedRoles,
}: RoleMatrixProps): JSX.Element => (
  <>
    <div>
      <p className="form-section-label">Roles:</p>
      <p className="form-description">
        You should independently verify that this user has completed all of the
        required training for the selected roles.
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
                  {eventCode === ALL_EVENTS_CODE ? "All Events" : eventCode}
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
                          onRoleToggle(eventCode, column.value);
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
  </>
);

interface StatusMessagesProps {
  errorMessage: string | null;
  successMessage: string | null;
}

export const StatusMessages = ({
  errorMessage,
  successMessage,
}: StatusMessagesProps): JSX.Element => (
  <>
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
  </>
);
