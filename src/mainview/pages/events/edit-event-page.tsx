import { useEffect, useState } from "react";
import {
  fetchEvent,
  type UpdateEventPayload,
  updateEvent,
} from "@/features/events/event-admin";
import {
  type EventFormCommonFields,
  EventFormFields,
} from "@/features/events/event-form-fields";
import { useEventFormController } from "@/features/events/use-event-form-controller";
import { LoadingIndicator } from "@/shared/components/loading-indicator";

interface EditEventPageProps {
  eventCode: string;
  token: string | null;
}

type EditableEventForm = UpdateEventPayload & EventFormCommonFields;

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
  const { dispatch, handleSubmit, setForm, state, updateField } =
    useEventFormController<
      EditableEventForm,
      Awaited<ReturnType<typeof updateEvent>>
    >({
      initialForm: null,
      onSubmit: (form, authToken) => updateEvent(eventCode, form, authToken),
      submitErrorMessage: "Failed to update event.",
      successMessage: "Event updated successfully.",
      token,
    });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    if (!token) {
      dispatch({
        payload: {
          errorMessage: "You must be logged in to edit this event.",
        },
        type: "set",
      });
      setIsLoading(false);
      return;
    }

    fetchEvent(eventCode, token)
      .then((result) => {
        if (isCancelled) {
          return;
        }

        const event = result.event;
        setForm({
          divisions: event.divisions,
          endDate: timestampToDateString(event.end),
          eventName: event.name,
          eventType: event.type,
          fields: event.fields ?? 1,
          finals: event.finals,
          region: event.region,
          startDate: timestampToDateString(event.start),
          status: event.status,
        });
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }

        dispatch({
          payload: {
            errorMessage:
              error instanceof Error
                ? error.message
                : "Failed to load event details.",
          },
          type: "set",
        });
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [dispatch, eventCode, setForm, token]);

  if (isLoading) {
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

          <EventFormFields form={state.form} onFieldChange={updateField} />
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
