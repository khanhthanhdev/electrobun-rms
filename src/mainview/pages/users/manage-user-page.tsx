import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
  type AccountFormState,
  beginAccountFormSubmit,
  roleKey,
  toRoleAssignments,
  useAccountFormController,
} from "@/features/users/account-form-controller";
import {
  AccountFormShell,
  AccountFormSubmitArea,
} from "@/features/users/account-form-view";
import {
  deleteUser,
  getUser,
  updateUser,
} from "@/features/users/services/users-service";
import { LoadingIndicator } from "@/shared/components/loading-indicator";
import type { EventItem } from "@/shared/types/event";

interface ManageUserPageProps {
  events: EventItem[];
  isEventsLoading: boolean;
  token: string | null;
  username: string;
}

const getDeleteButtonLabel = ({
  isDeleteConfirming,
  isDeleting,
}: {
  isDeleteConfirming: boolean;
  isDeleting: boolean;
}): string => {
  if (isDeleting) {
    return "Deleting Account...";
  }

  if (isDeleteConfirming) {
    return "Delete Account (Confirm)";
  }

  return "Delete Account";
};

export const ManageUserPage = ({
  events,
  isEventsLoading,
  token,
  username,
}: ManageUserPageProps): JSX.Element => {
  const { dispatch, eventRows, handleRoleToggle, state, validateBeforeSubmit } =
    useAccountFormController({
      events,
      initialUsername: username,
      mode: "manage",
    });
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const setField = useCallback(
    (payload: Partial<AccountFormState>): void => {
      dispatch({
        payload,
        type: "set",
      });
    },
    [dispatch]
  );

  useEffect(() => {
    let isCancelled = false;

    if (!token) {
      setField({
        errorMessage: "You must be logged in as an admin user.",
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setField({ errorMessage: null });

    getUser(username, token)
      .then((result) => {
        if (isCancelled) {
          return;
        }

        setField({
          accountUsername: result.user.username,
          selectedRoles: new Set(
            result.user.roles.map((assignment) =>
              roleKey(assignment.event, assignment.role)
            )
          ),
        });
        setIsDeleteConfirming(false);
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }

        setField({
          errorMessage:
            error instanceof Error
              ? error.message
              : "Failed to load user details.",
        });
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
  }, [token, username, setField]);

  const handleUpdate = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    const submitToken = beginAccountFormSubmit({
      event,
      onBeforeValidate: () => {
        setIsDeleteConfirming(false);
      },
      setField,
      token,
      validateBeforeSubmit,
    });
    if (!submitToken) {
      return;
    }

    try {
      await updateUser(
        state.accountUsername,
        {
          password: state.password,
          passwordConfirm: state.passwordConfirm,
          roles: toRoleAssignments(state.selectedRoles),
        },
        submitToken
      );

      setField({
        password: "",
        passwordConfirm: "",
        successMessage: `Account "${state.accountUsername}" was updated.`,
      });
    } catch (error) {
      setField({
        errorMessage:
          error instanceof Error ? error.message : "Failed to update account.",
      });
    } finally {
      setField({ isSubmitting: false });
    }
  };

  const handleDelete = async (): Promise<void> => {
    setField({
      errorMessage: null,
      successMessage: null,
    });

    if (!token) {
      setField({ errorMessage: "You must be logged in as an admin user." });
      return;
    }

    if (!isDeleteConfirming) {
      setIsDeleteConfirming(true);
      setField({
        errorMessage: `Click "Delete Account" again to delete "${state.accountUsername}".`,
      });
      return;
    }

    setIsDeleting(true);

    try {
      await deleteUser(state.accountUsername, token);
      window.history.pushState({}, "", "/user/manage");
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (error) {
      setField({
        errorMessage:
          error instanceof Error ? error.message : "Failed to delete account.",
      });
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

  if (state.errorMessage && state.selectedRoles.size === 0) {
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

  const deleteButtonLabel = getDeleteButtonLabel({
    isDeleteConfirming,
    isDeleting,
  });

  return (
    <main className="page-shell page-shell--top">
      <AccountFormShell
        actions={
          <AccountFormSubmitArea className="form-actions form-actions--between">
            <button disabled={isDeleting || state.isSubmitting} type="submit">
              {state.isSubmitting ? "Updating Account..." : "Update Account"}
            </button>
            <button
              data-variant="danger"
              disabled={isDeleting || state.isSubmitting}
              onClick={handleDelete}
              type="button"
            >
              {deleteButtonLabel}
            </button>
          </AccountFormSubmitArea>
        }
        eventRows={eventRows}
        isEventsLoading={isEventsLoading}
        onRoleToggle={handleRoleToggle}
        onSubmit={handleUpdate}
        setField={setField}
        state={state}
        username={{ disabled: true }}
      />
    </main>
  );
};
