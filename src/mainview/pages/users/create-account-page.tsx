import type { FormEvent } from "react";
import {
  type AccountFormState,
  beginAccountFormSubmit,
  normalizeAccountUsername,
  toRoleAssignments,
  useAccountFormController,
} from "@/features/users/account-form-controller";
import {
  AccountFormShell,
  AccountFormSubmitArea,
} from "@/features/users/account-form-view";
import { createUserAccount } from "@/features/users/services/users-service";
import type { EventItem } from "@/shared/types/event";

interface CreateAccountPageProps {
  events: EventItem[];
  isEventsLoading: boolean;
  token: string | null;
}

export const CreateAccountPage = ({
  events,
  isEventsLoading,
  token,
}: CreateAccountPageProps): JSX.Element => {
  const { dispatch, eventRows, handleRoleToggle, state, validateBeforeSubmit } =
    useAccountFormController({
      events,
      mode: "create",
    });

  const setField = (payload: Partial<AccountFormState>): void => {
    dispatch({
      payload,
      type: "set",
    });
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    const submitToken = beginAccountFormSubmit({
      event,
      setField,
      token,
      validateBeforeSubmit,
    });
    if (!submitToken) {
      return;
    }

    try {
      const normalizedUsername = normalizeAccountUsername(
        state.accountUsername
      );
      const result = await createUserAccount(
        {
          password: state.password,
          passwordConfirm: state.passwordConfirm,
          roles: toRoleAssignments(state.selectedRoles),
          username: normalizedUsername,
        },
        submitToken
      );

      setField({
        accountUsername: "",
        password: "",
        passwordConfirm: "",
        selectedRoles: new Set(),
        successMessage: `Account "${result.user.username}" was created.`,
      });
    } catch (error) {
      setField({
        errorMessage:
          error instanceof Error ? error.message : "Failed to create account.",
      });
    } finally {
      setField({ isSubmitting: false });
    }
  };

  const hasEvents = eventRows.length > 1;

  return (
    <main className="page-shell page-shell--top">
      <AccountFormShell
        actions={
          <AccountFormSubmitArea>
            <button
              disabled={state.isSubmitting || isEventsLoading}
              type="submit"
            >
              {state.isSubmitting ? "Creating Account..." : "Create Account"}
            </button>
          </AccountFormSubmitArea>
        }
        emptyEventsNote={
          isEventsLoading || hasEvents ? null : (
            <p className="form-note">
              No event-specific rows available yet. You can still assign roles
              in "All Events".
            </p>
          )
        }
        eventRows={eventRows}
        isEventsLoading={isEventsLoading}
        onRoleToggle={handleRoleToggle}
        onSubmit={handleSubmit}
        passwordRequired
        setField={setField}
        state={state}
        username={{
          placeholder: "Enter username",
          required: true,
        }}
      />
    </main>
  );
};
