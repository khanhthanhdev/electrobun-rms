import {
  type CreateManualEventPayload,
  createManualEvent,
} from "@/features/events/event-admin";
import {
  type EventFormCommonFields,
  type EventFormFieldChangeHandler,
  EventFormFields,
} from "@/features/events/event-form-fields";
import { useEventFormController } from "@/features/events/use-event-form-controller";

const MAX_EVENT_CODE_LENGTH = 8;
const EVENT_CODE_INPUT_TITLE = "Event code must be 1-8 letters or digits.";

interface CreateEventPageProps {
  token: string | null;
}

type CreateEventForm = CreateManualEventPayload & EventFormCommonFields;

const INITIAL_FORM: CreateEventForm = {
  divisions: 1,
  endDate: "",
  eventCode: "",
  eventName: "",
  eventType: 1,
  fields: 1,
  region: "",
  startDate: "",
};

export const CreateEventPage = ({
  token,
}: CreateEventPageProps): JSX.Element => {
  const { handleSubmit, state, updateField } = useEventFormController<
    CreateEventForm,
    Awaited<ReturnType<typeof createManualEvent>>
  >({
    initialForm: INITIAL_FORM,
    onSubmit: createManualEvent,
    onSubmitSuccess: (result) => {
      window.history.pushState(
        {},
        "",
        `/event/${result.event.code}/dashboard/defaultaccounts`
      );
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
    submitErrorMessage: "Failed to create event.",
    token,
  });

  const handleCommonFieldChange: EventFormFieldChangeHandler = (key, value) => {
    updateField(
      key as keyof CreateEventForm,
      value as CreateEventForm[keyof CreateEventForm]
    );
  };

  if (!state.form) {
    return (
      <main className="page-shell page-shell--center">
        <p className="message-block" data-variant="danger" role="alert">
          Failed to load form.
        </p>
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
          <h2 className="app-heading app-heading--center">
            Create Manual Event
          </h2>
          <p className="app-subheading app-subheading--center">
            Set up a new event.
          </p>
        </header>

        {state.errorMessage ? (
          <p className="message-block" data-variant="danger" role="alert">
            {state.errorMessage}
          </p>
        ) : null}

        <div className="stack stack--compact">
          <div className="form-row" data-field>
            <label htmlFor="eventCode">Event Code</label>
            <input
              id="eventCode"
              maxLength={MAX_EVENT_CODE_LENGTH}
              minLength={1}
              onChange={(e) => {
                updateField(
                  "eventCode",
                  e.target.value.slice(0, MAX_EVENT_CODE_LENGTH)
                );
              }}
              pattern="[A-Za-z0-9]+"
              placeholder="e.g. nrc2026"
              required
              title={EVENT_CODE_INPUT_TITLE}
              type="text"
              value={state.form.eventCode}
            />
            <p className="form-help" data-hint>
              1-8 characters: letters and digits only.
            </p>
          </div>

          <EventFormFields
            endDateMin={state.form.startDate || undefined}
            eventNamePlaceholder="e.g. National Robotics Competition 2026"
            fieldsMax={100}
            form={state.form}
            onFieldChange={handleCommonFieldChange}
            regionPlaceholder="e.g. Vietnam"
          />
        </div>

        <button
          className="form-submit"
          disabled={state.isSubmitting}
          type="submit"
        >
          {state.isSubmitting ? "Creating Event..." : "Create Event"}
        </button>
      </form>
    </main>
  );
};
