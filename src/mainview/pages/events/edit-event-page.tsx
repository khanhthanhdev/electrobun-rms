import { type FormEvent, useEffect, useReducer } from "react";
import type { UpdateEventPayload } from "../../features/events/services/manual-event-service";
import {
  fetchEvent,
  updateEvent,
} from "../../features/events/services/manual-event-service";
import { LoadingIndicator } from "../../shared/components/loading-indicator";

interface EditEventPageProps {
  eventCode: string;
  token: string | null;
}

interface EditEventPageState {
  errorMessage: string | null;
  form: UpdateEventPayload | null;
  isLoading: boolean;
  isSubmitting: boolean;
  successMessage: string | null;
}

type EditEventPageAction =
  | {
      type: "set";
      payload: Partial<EditEventPageState>;
    }
  | {
      type: "updateField";
      key: keyof UpdateEventPayload;
      value: UpdateEventPayload[keyof UpdateEventPayload];
    };

const editEventPageInitialState: EditEventPageState = {
  form: null,
  isLoading: true,
  isSubmitting: false,
  errorMessage: null,
  successMessage: null,
};

const editEventPageReducer = (
  state: EditEventPageState,
  action: EditEventPageAction
): EditEventPageState => {
  switch (action.type) {
    case "set":
      return { ...state, ...action.payload };
    case "updateField":
      return {
        ...state,
        form: state.form
          ? {
              ...state.form,
              [action.key]: action.value,
            }
          : state.form,
      };
    default:
      return state;
  }
};

const timestampToDateString = (ts: number): string => {
  const date = new Date(ts);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const EditEventPage = ({
  eventCode,
  token,
}: EditEventPageProps): JSX.Element => {
  const [state, dispatch] = useReducer(
    editEventPageReducer,
    editEventPageInitialState
  );

  useEffect(() => {
    let isCancelled = false;

    if (!token) {
      dispatch({
        type: "set",
        payload: {
          errorMessage: "You must be logged in to edit this event.",
          isLoading: false,
        },
      });
      return;
    }

    fetchEvent(eventCode, token)
      .then((result) => {
        if (!isCancelled) {
          const event = result.event;
          dispatch({
            type: "set",
            payload: {
              form: {
                eventName: event.name,
                region: event.region,
                eventType: event.type,
                startDate: timestampToDateString(event.start),
                endDate: timestampToDateString(event.end),
                divisions: event.divisions,
                finals: event.finals,
                status: event.status,
              },
            },
          });
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          dispatch({
            type: "set",
            payload: {
              errorMessage:
                error instanceof Error
                  ? error.message
                  : "Failed to load event details.",
            },
          });
        }
      })
      .finally(() => {
        if (!isCancelled) {
          dispatch({
            type: "set",
            payload: {
              isLoading: false,
            },
          });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [eventCode, token]);

  const updateField = <K extends keyof UpdateEventPayload>(
    key: K,
    value: UpdateEventPayload[K]
  ): void => {
    dispatch({
      type: "updateField",
      key,
      value,
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!token) {
      dispatch({
        type: "set",
        payload: {
          errorMessage: "You must be logged in.",
        },
      });
      return;
    }
    if (!state.form) {
      return;
    }

    dispatch({
      type: "set",
      payload: {
        isSubmitting: true,
        errorMessage: null,
        successMessage: null,
      },
    });

    try {
      await updateEvent(eventCode, state.form, token);
      dispatch({
        type: "set",
        payload: {
          successMessage: "Event updated successfully.",
        },
      });
    } catch (error) {
      dispatch({
        type: "set",
        payload: {
          errorMessage:
            error instanceof Error ? error.message : "Failed to update event.",
        },
      });
    } finally {
      dispatch({
        type: "set",
        payload: {
          isSubmitting: false,
        },
      });
    }
  };

  if (state.isLoading) {
    return (
      <main className="page-shell page-shell--center">
        <LoadingIndicator />
      </main>
    );
  }

  if (!state.form) {
    return (
      <main className="page-shell page-shell--center">
        <div className="card surface-card surface-card--small stack stack--compact">
          <p className="message-block" data-variant="danger" role="alert">
            {state.errorMessage ?? "Failed to load event."}
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
      <form
        className="card surface-card surface-card--small stack"
        onSubmit={handleSubmit}
      >
        <header>
          <h2 className="app-heading app-heading--center">Edit Event</h2>
          <p className="app-subheading app-subheading--center">
            Update event details for <strong>{eventCode}</strong>.
          </p>
        </header>

        {state.errorMessage ? (
          <p className="message-block" data-variant="danger" role="alert">
            {state.errorMessage}
          </p>
        ) : null}

        {state.successMessage ? (
          <output className="message-block" data-variant="success">
            {state.successMessage}
          </output>
        ) : null}

        <div className="stack stack--compact">
          <div className="form-row" data-field>
            <label htmlFor="eventCode">Event Code</label>
            <input disabled id="eventCode" type="text" value={eventCode} />
          </div>

          <div className="form-row" data-field>
            <label htmlFor="eventName">Event Name</label>
            <input
              id="eventName"
              onChange={(e) => {
                updateField("eventName", e.target.value);
              }}
              required
              type="text"
              value={state.form.eventName}
            />
          </div>

          <div className="form-row" data-field>
            <label htmlFor="region">Region</label>
            <input
              id="region"
              onChange={(e) => {
                updateField("region", e.target.value);
              }}
              required
              type="text"
              value={state.form.region}
            />
          </div>

          <div className="form-grid-2">
            <div>
              <label htmlFor="startDate">Start Date</label>
              <input
                id="startDate"
                onChange={(e) => {
                  updateField("startDate", e.target.value);
                }}
                required
                type="date"
                value={state.form.startDate}
              />
            </div>
            <div>
              <label htmlFor="endDate">End Date</label>
              <input
                id="endDate"
                onChange={(e) => {
                  updateField("endDate", e.target.value);
                }}
                required
                type="date"
                value={state.form.endDate}
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div>
              <label htmlFor="eventType">Event Type</label>
              <input
                id="eventType"
                min={0}
                onChange={(e) => {
                  updateField("eventType", Number(e.target.value));
                }}
                required
                type="number"
                value={state.form.eventType}
              />
            </div>
            <div>
              <label htmlFor="divisions">Divisions</label>
              <input
                id="divisions"
                min={1}
                onChange={(e) => {
                  updateField("divisions", Number(e.target.value));
                }}
                required
                type="number"
                value={state.form.divisions}
              />
            </div>
          </div>
        </div>

        <button
          className="form-submit"
          disabled={state.isSubmitting}
          type="submit"
        >
          {state.isSubmitting ? "Saving..." : "Save Event"}
        </button>

        <div className="form-actions">
          <a className="app-link-inline" href={`/event/${eventCode}/dashboard`}>
            Back to Dashboard
          </a>
        </div>
      </form>
    </main>
  );
};
