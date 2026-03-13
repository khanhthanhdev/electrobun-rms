import { type FormEvent, useEffect, useState } from "react";
import {
  bootstrapSyncEvent,
  fetchNrcWebBaseUrl,
} from "@/features/events/event-admin";

const LOCAL_NRC_WEB_BASE_URL = "http://localhost:3001";
const MAX_EVENT_CODE_LENGTH = 8;
const EVENT_CODE_INPUT_TITLE = "Event code must be 1-8 letters or digits.";

interface SyncEventPageProps {
  token: string | null;
}

export const SyncEventPage = ({ token }: SyncEventPageProps): JSX.Element => {
  const [baseUrl, setBaseUrl] = useState("");
  const [eventCode, setEventCode] = useState("");
  const [eventKey, setEventKey] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    fetchNrcWebBaseUrl(token)
      .then((data) => {
        if (data.baseUrl) {
          setBaseUrl(data.baseUrl);
        }
      })
      .catch(() => {
        // Ignore errors - user can manually enter URL
      });
  }, [token]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!token) {
      setErrorMessage("You must be logged in.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await bootstrapSyncEvent(
        {
          baseUrl: baseUrl.trim() || undefined,
          eventCode: eventCode.trim(),
          eventKey: eventKey.trim(),
        },
        token
      );

      window.history.pushState({}, "", result.redirectUrl);
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Bootstrap failed."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="page-shell page-shell--top">
      <form
        className="card surface-card surface-card--small stack"
        onSubmit={handleSubmit}
      >
        <header>
          <h2 className="app-heading app-heading--center">
            Sync Event from NRC Web
          </h2>
          <p className="app-subheading app-subheading--center">
            Bootstrap a local event from NRC Web.
          </p>
        </header>

        {errorMessage ? (
          <p className="message-block" data-variant="danger" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="stack stack--compact">
          <div className="form-row" data-field>
            <label htmlFor="baseUrl">NRC Web Base URL</label>
            <input
              id="baseUrl"
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={LOCAL_NRC_WEB_BASE_URL}
              type="url"
              value={baseUrl}
            />
            <p className="form-help" data-hint>
              Current local NRC Web origin: {LOCAL_NRC_WEB_BASE_URL}. Stored as
              server setting for future sync operations.
            </p>
          </div>

          <div className="form-row" data-field>
            <label htmlFor="eventCode">Local Event Code</label>
            <input
              id="eventCode"
              maxLength={MAX_EVENT_CODE_LENGTH}
              minLength={1}
              onChange={(e) => {
                setEventCode(e.target.value.slice(0, MAX_EVENT_CODE_LENGTH));
              }}
              pattern="[A-Za-z0-9]+"
              placeholder="e.g. nrc2026"
              required
              title={EVENT_CODE_INPUT_TITLE}
              type="text"
              value={eventCode}
            />
            <p className="form-help" data-hint>
              Required. Use a local code with 1-8 letters or digits.
            </p>
          </div>

          <div className="form-row" data-field>
            <label htmlFor="eventKey">NRC Web Event Key</label>
            <input
              id="eventKey"
              onChange={(e) => setEventKey(e.target.value)}
              placeholder="Paste your NRC Web machine bearer token"
              required
              type="password"
              value={eventKey}
            />
            <p className="form-help" data-hint>
              Raw bearer secret for machine-to-machine authentication.
            </p>
          </div>
        </div>

        <button className="form-submit" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Bootstrapping Event..." : "Bootstrap Event"}
        </button>
      </form>
    </main>
  );
};
