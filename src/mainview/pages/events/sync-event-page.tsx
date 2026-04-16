import { type FormEvent, useEffect, useState } from "react";
import {
  bootstrapSyncEvent,
  fetchNrcWebBaseUrl,
  fetchOutboundSyncStatus,
  type OutboundSyncStatusResponse,
  retryOutboundSync,
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
  const [isRetrying, setIsRetrying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [outboundStatus, setOutboundStatus] =
    useState<OutboundSyncStatusResponse | null>(null);

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

  useEffect(() => {
    if (!(token && eventCode.trim())) {
      setOutboundStatus(null);
      return;
    }

    fetchOutboundSyncStatus(eventCode.trim(), token)
      .then((status) => {
        setOutboundStatus(status);
      })
      .catch(() => {
        setOutboundStatus(null);
      });
  }, [eventCode, token]);

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

  const handleRetryOutboundSync = async (): Promise<void> => {
    if (!(token && eventCode.trim())) {
      return;
    }

    setIsRetrying(true);
    setRetryMessage(null);
    try {
      const result = await retryOutboundSync(eventCode.trim(), token);
      const status = await fetchOutboundSyncStatus(eventCode.trim(), token);
      setOutboundStatus(status);
      setRetryMessage(`Queued batch ${result.batchId} for retry.`);
    } catch (error) {
      setRetryMessage(
        error instanceof Error ? error.message : "Retry request failed."
      );
    } finally {
      setIsRetrying(false);
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

        <section className="stack stack--compact">
          <h3 className="app-heading app-heading--small">
            Outbound Sync Status
          </h3>
          <p className="form-help" data-hint>
            Event code is required to inspect queue and trigger manual retry.
          </p>
          {outboundStatus ? (
            <div className="stack stack--compact">
              <p className="form-help" data-hint>
                Link:{" "}
                {outboundStatus.hasOutboundLink ? "Configured" : "Missing"}
                {" · "}Enabled: {outboundStatus.isSyncEnabled ? "Yes" : "No"}
              </p>
              <p className="form-help" data-hint>
                queued {outboundStatus.counts.queued}, in-flight{" "}
                {outboundStatus.counts.in_flight}, failed{" "}
                {outboundStatus.counts.failed}, pending review{" "}
                {outboundStatus.counts.pending_review}
              </p>
              {outboundStatus.lastError ? (
                <p className="form-help" data-hint>
                  Last error: {outboundStatus.lastError}
                </p>
              ) : null}
            </div>
          ) : null}
          {retryMessage ? (
            <p className="form-help" data-hint>
              {retryMessage}
            </p>
          ) : null}
          <button
            className="form-submit"
            disabled={isRetrying || !token || !eventCode.trim()}
            onClick={() => {
              handleRetryOutboundSync();
            }}
            type="button"
          >
            {isRetrying ? "Queueing Retry..." : "Retry Outbound Push"}
          </button>
        </section>
      </form>
    </main>
  );
};
