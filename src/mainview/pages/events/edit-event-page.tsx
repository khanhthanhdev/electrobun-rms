import { type FormEvent, useEffect, useState } from "react";
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
  const [form, setForm] = useState<UpdateEventPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    if (!token) {
      setErrorMessage("You must be logged in to edit this event.");
      setIsLoading(false);
      return;
    }

    fetchEvent(eventCode, token)
      .then((result) => {
        if (!isCancelled) {
          const event = result.event;
          setForm({
            eventName: event.name,
            region: event.region,
            eventType: event.type,
            startDate: timestampToDateString(event.start),
            endDate: timestampToDateString(event.end),
            divisions: event.divisions,
            finals: event.finals,
            status: event.status,
          });
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Failed to load event details."
          );
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
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
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!token) {
      setErrorMessage("You must be logged in.");
      return;
    }
    if (!form) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await updateEvent(eventCode, form, token);
      setSuccessMessage("Event updated successfully.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to update event."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="page-shell page-shell--center">
        <LoadingIndicator />
      </main>
    );
  }

  if (!form) {
    return (
      <main className="page-shell page-shell--center">
        <div className="card surface-card surface-card--small stack stack--compact">
          <p className="message-block" data-variant="danger" role="alert">
            {errorMessage ?? "Failed to load event."}
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

        {errorMessage ? (
          <p className="message-block" data-variant="danger" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {successMessage ? (
          <output className="message-block" data-variant="success">
            {successMessage}
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
              value={form.eventName}
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
              value={form.region}
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
                value={form.startDate}
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
                value={form.endDate}
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
                value={form.eventType}
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
                value={form.divisions}
              />
            </div>
          </div>
        </div>

        <button className="form-submit" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Saving..." : "Save Event"}
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
