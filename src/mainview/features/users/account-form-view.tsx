import type { FormEvent, ReactNode } from "react";
import type { RoleValue } from "@/shared/constants/roles";
import type { AccountFormState } from "./account-form-controller";
import { AccountPasswordFields, RoleMatrix } from "./account-form-fields";

export const AccountFormSubmitArea = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element => <div className={className}>{children}</div>;

const AccountStatusMessages = ({
  errorMessage,
  successMessage,
}: {
  errorMessage: string | null;
  successMessage: string | null;
}): JSX.Element => (
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

interface AccountFormShellProps {
  actions: ReactNode;
  emptyEventsNote?: ReactNode;
  eventRows: readonly string[];
  isEventsLoading: boolean;
  onRoleToggle: (eventCode: string, role: RoleValue) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  passwordRequired?: boolean;
  setField: (payload: Partial<AccountFormState>) => void;
  state: AccountFormState;
  username: {
    disabled?: boolean;
    placeholder?: string;
    required?: boolean;
  };
}

export const AccountFormShell = ({
  actions,
  emptyEventsNote,
  eventRows,
  isEventsLoading,
  onRoleToggle,
  onSubmit,
  passwordRequired = false,
  setField,
  state,
  username,
}: AccountFormShellProps): JSX.Element => (
  <form
    className="card surface-card surface-card--xlarge stack"
    onSubmit={onSubmit}
  >
    <div className="stack">
      <div className="form-row" data-field>
        <label htmlFor="username">Username:</label>
        <input
          disabled={username.disabled}
          id="username"
          onChange={(nextEvent) => {
            setField({ accountUsername: nextEvent.target.value });
          }}
          placeholder={username.placeholder}
          required={username.required}
          type="text"
          value={state.accountUsername}
        />
      </div>

      <AccountPasswordFields
        onPasswordChange={(value) => {
          setField({ password: value });
        }}
        onPasswordConfirmChange={(value) => {
          setField({ passwordConfirm: value });
        }}
        onShowPasswordChange={(checked) => {
          setField({ showPassword: checked });
        }}
        onShowPasswordConfirmChange={(checked) => {
          setField({ showPasswordConfirm: checked });
        }}
        password={state.password}
        passwordConfirm={state.passwordConfirm}
        required={passwordRequired}
        showPassword={state.showPassword}
        showPasswordConfirm={state.showPasswordConfirm}
      />

      <RoleMatrix
        eventRows={eventRows}
        isEventsLoading={isEventsLoading}
        onRoleToggle={onRoleToggle}
        selectedRoles={state.selectedRoles}
      />

      {emptyEventsNote}

      <AccountStatusMessages
        errorMessage={state.errorMessage}
        successMessage={state.successMessage}
      />

      {actions}
    </div>
  </form>
);
