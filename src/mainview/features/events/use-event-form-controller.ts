import { type FormEvent, useCallback, useReducer } from "react";

export interface EventFormState<TForm> {
  errorMessage: string | null;
  form: TForm | null;
  isSubmitting: boolean;
  successMessage: string | null;
}

export type EventFormAction<TForm> =
  | {
      payload: Partial<EventFormState<TForm>>;
      type: "set";
    }
  | {
      form: TForm | null;
      type: "setForm";
    }
  | {
      key: keyof TForm;
      type: "updateField";
      value: TForm[keyof TForm];
    }
  | {
      type: "submitStart";
    }
  | {
      message: string;
      type: "submitError";
    }
  | {
      message: string | null;
      type: "submitSuccess";
    };

export const createEventFormState = <TForm>(
  form: TForm | null
): EventFormState<TForm> => ({
  errorMessage: null,
  form,
  isSubmitting: false,
  successMessage: null,
});

export const updateEventFormField = <TForm, K extends keyof TForm>(
  form: TForm,
  key: K,
  value: TForm[K]
): TForm => ({
  ...form,
  [key]: value,
});

export const normalizeEventFormError = (
  error: unknown,
  fallbackMessage: string
): string => (error instanceof Error ? error.message : fallbackMessage);

export const eventFormReducer = <TForm>(
  state: EventFormState<TForm>,
  action: EventFormAction<TForm>
): EventFormState<TForm> => {
  switch (action.type) {
    case "set":
      return { ...state, ...action.payload };
    case "setForm":
      return { ...state, form: action.form };
    case "updateField":
      return {
        ...state,
        form: state.form
          ? updateEventFormField(state.form, action.key, action.value)
          : state.form,
      };
    case "submitStart":
      return {
        ...state,
        errorMessage: null,
        isSubmitting: true,
        successMessage: null,
      };
    case "submitError":
      return {
        ...state,
        errorMessage: action.message,
        isSubmitting: false,
      };
    case "submitSuccess":
      return {
        ...state,
        isSubmitting: false,
        successMessage: action.message,
      };
    default:
      return state;
  }
};

interface UseEventFormControllerOptions<TForm, TSubmitResult> {
  initialForm: TForm | null;
  missingTokenMessage?: string;
  onSubmit: (form: TForm, token: string) => Promise<TSubmitResult>;
  onSubmitSuccess?: (
    result: TSubmitResult,
    form: TForm
  ) => Promise<void> | void;
  submitErrorMessage: string;
  successMessage?: string;
  token: string | null;
}

export const useEventFormController = <TForm, TSubmitResult = void>({
  initialForm,
  missingTokenMessage = "You must be logged in.",
  onSubmit,
  onSubmitSuccess,
  submitErrorMessage,
  successMessage,
  token,
}: UseEventFormControllerOptions<TForm, TSubmitResult>) => {
  const [state, dispatch] = useReducer(
    eventFormReducer<TForm>,
    createEventFormState(initialForm)
  );

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();

    if (!token) {
      dispatch({
        payload: {
          errorMessage: missingTokenMessage,
        },
        type: "set",
      });
      return;
    }

    if (!state.form) {
      return;
    }

    dispatch({ type: "submitStart" });

    try {
      const result = await onSubmit(state.form, token);
      if (onSubmitSuccess) {
        await onSubmitSuccess(result, state.form);
      }
      dispatch({
        message: successMessage ?? null,
        type: "submitSuccess",
      });
    } catch (error) {
      dispatch({
        message: normalizeEventFormError(error, submitErrorMessage),
        type: "submitError",
      });
    }
  };

  const updateField = useCallback(
    <K extends keyof TForm>(key: K, value: TForm[K]): void => {
      dispatch({
        key,
        type: "updateField",
        value,
      });
    },
    []
  );

  const setForm = useCallback((form: TForm | null): void => {
    dispatch({ form, type: "setForm" });
  }, []);

  return {
    dispatch,
    handleSubmit,
    setForm,
    state,
    updateField,
  };
};
