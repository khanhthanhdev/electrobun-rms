import { type FormEvent, useState } from "react";
import type {
  CreateManualEventPayload,
  DefaultAccountInfo,
} from "../features/events/services/manual-event-service";
import { createManualEvent } from "../features/events/services/manual-event-service";

interface CreateEventPageProps {
  token: string | null;
}

const INITIAL_FORM: CreateManualEventPayload = {
  divisions: 1,
  endDate: "",
  eventCode: "",
  eventName: "",
  eventType: 1,
  region: "",
  startDate: "",
};

export const CreateEventPage = ({
  token,
}: CreateEventPageProps): JSX.Element => {
  const [form, setForm] = useState<CreateManualEventPayload>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdAccounts, setCreatedAccounts] = useState<
    DefaultAccountInfo[] | null
  >(null);
  const [createdEventCode, setCreatedEventCode] = useState<string | null>(null);

  const updateField = <K extends keyof CreateManualEventPayload>(
    key: K,
    value: CreateManualEventPayload[K]
  ): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!token) {
      setErrorMessage("You must be logged in.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await createManualEvent(form, token);
      setCreatedAccounts(result.defaultAccounts);
      setCreatedEventCode(result.event.code);

      window.history.pushState(
        {},
        "",
        `/event/${result.event.code}/dashboard/defaultaccounts`
      );
      window.dispatchEvent(new PopStateEvent("popstate"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to create event."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (createdAccounts && createdEventCode) {
    return (
      <DefaultAccountsDisplay
        accounts={createdAccounts}
        eventCode={createdEventCode}
      />
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
            Set up a new event with default accounts.
          </p>
        </header>

        {errorMessage ? (
          <p className="message-block" data-variant="danger" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="stack stack--compact">
          <div className="form-row" data-field>
            <label htmlFor="eventCode">Event Code</label>
            <input
              id="eventCode"
              maxLength={4}
              onChange={(e) => {
                updateField(
                  "eventCode",
                  e.target.value.toLowerCase().slice(0, 4)
                );
              }}
              pattern="[a-z0-9_]+"
              placeholder="e.g. nrc1"
              required
              type="text"
              value={form.eventCode}
            />
            <p className="form-help" data-hint>
              Up to 4 characters: lowercase letters, digits, and underscores
              only.
            </p>
          </div>

          <div className="form-row" data-field>
            <label htmlFor="eventName">Event Name</label>
            <input
              id="eventName"
              onChange={(e) => {
                updateField("eventName", e.target.value);
              }}
              placeholder="e.g. National Robotics Competition 2026"
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
              placeholder="e.g. Vietnam"
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
          {isSubmitting ? "Creating Event..." : "Create Event"}
        </button>
      </form>
    </main>
  );
};

interface DefaultAccountsDisplayProps {
  accounts: DefaultAccountInfo[];
  eventCode: string;
}

const DefaultAccountsDisplay = ({
  accounts,
  eventCode,
}: DefaultAccountsDisplayProps): JSX.Element => (
  <main className="page-shell page-shell--top">
    <div className="card surface-card surface-card--medium stack stack--compact">
      <header>
        <h2 className="app-heading">Default Accounts - {eventCode}</h2>
        <p className="app-subheading">
          Save these credentials. Passwords are shown only here and on the
          default accounts page.
        </p>
      </header>

      <div className="table-wrap">
        <table className="table-credentials">
          <thead>
            <tr>
              <th scope="col">Username</th>
              <th scope="col">Role</th>
              <th scope="col">Password</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.username}>
                <td>{account.username}</td>
                <td>{account.role}</td>
                <td>{account.password}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <a className="button" href="/">
          Back to Home
        </a>
      </div>
    </div>
  </main>
);
