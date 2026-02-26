import { LoadingIndicator } from "../../../shared/components/loading-indicator";
import type { EventItem } from "../../../shared/types/event";

interface RefereeSelectionPageProps {
  eventCode: string;
  events: EventItem[];
  isEventsLoading: boolean;
  onNavigate: (path: string) => void;
  role: "red" | "blue" | "hr";
}

export const RefereeSelectionPage = ({
  eventCode,
  events,
  isEventsLoading,
  role,
  onNavigate,
}: RefereeSelectionPageProps): JSX.Element => {
  if (isEventsLoading) {
    return (
      <main className="page-shell page-shell--center">
        <LoadingIndicator />
      </main>
    );
  }

  const event = events.find((e) => e.code === eventCode);

  if (!event) {
    return (
      <main className="page-shell page-shell--center">
        <div className="card surface-card surface-card--small stack stack--compact">
          <p className="message-block" data-variant="danger" role="alert">
            Event not found.
          </p>
          <a className="app-link-inline" href="/">
            Back to Home
          </a>
        </div>
      </main>
    );
  }

  const fields = event.fields || 1;

  const roleStyles = {
    red: {
      headerBg: "#dc2626", // Tailwind red-600
      headerColor: "white",
      title: "Field Selection (Scoring)",
      fieldsFirst: true,
    },
    blue: {
      headerBg: "#0284c7", // Tailwind sky-600
      headerColor: "white",
      title: "Field Selection (Scoring)",
      fieldsFirst: true,
    },
    hr: {
      headerBg: "#f97316", // Tailwind orange-500
      headerColor: "white",
      title: "Field Selection",
      fieldsFirst: false,
    },
  };

  const config = roleStyles[role];

  const handleSelection = (fieldNumber: number | "all") => {
    if (fieldNumber === "all") {
      onNavigate(
        `/event/${eventCode}/${role === "hr" ? "hr" : `ref/${role}/scoring`}/all`
      );
    } else {
      onNavigate(
        `/event/${eventCode}/${role === "hr" ? "hr" : `ref/${role}/scoring`}/${fieldNumber}`
      );
    }
  };

  return (
    <main
      style={{
        backgroundColor: "#f9fafb",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: "2rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: "800px", padding: "0 1rem" }}>
        {/* Header */}
        <div
          style={{
            backgroundColor: config.headerBg,
            color: config.headerColor,
            padding: "1rem",
            borderRadius: "0.25rem",
            marginBottom: "1.5rem",
          }}
        >
          <button
            onClick={() => onNavigate(`/event/${eventCode}`)}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              fontSize: "0.85rem",
              opacity: 0.9,
              padding: 0,
              display: "block",
              marginBottom: "0.4rem",
            }}
            type="button"
          >
            ← Back to Home
          </button>
          <div
            style={{
              textAlign: "center",
              fontWeight: "600",
              fontSize: "1.125rem",
            }}
          >
            {config.title}
          </div>
        </div>

        {/* Buttons container */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {!config.fieldsFirst && (
            <>
              <button
                onClick={() => handleSelection("all")}
                style={{
                  width: "100%",
                  padding: "0.875rem",
                  backgroundColor: "white",
                  color: "#3b82f6",
                  border: "1px solid #93c5fd",
                  borderRadius: "0.25rem",
                  fontSize: "1.125rem",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                }}
                type="button"
              >
                All Matches
              </button>
              <hr
                style={{
                  border: "0",
                  borderTop: "1px solid #e5e7eb",
                  margin: "0.5rem 0",
                }}
              />
            </>
          )}

          {Array.from({ length: fields }).map((_, i) => (
            <button
              key={`field-${i + 1}`}
              onClick={() => handleSelection(i + 1)}
              style={{
                width: "100%",
                padding: "0.875rem",
                backgroundColor: "white",
                color: "#3b82f6",
                border: "1px solid #93c5fd",
                borderRadius: "0.25rem",
                fontSize: "1.125rem",
                cursor: "pointer",
                transition: "background-color 0.2s",
              }}
              type="button"
            >
              Field {i + 1}
            </button>
          ))}

          {config.fieldsFirst && (
            <>
              <hr
                style={{
                  border: "0",
                  borderTop: "1px solid #e5e7eb",
                  margin: "0.5rem 0",
                }}
              />
              <button
                onClick={() => handleSelection("all")}
                style={{
                  width: "100%",
                  padding: "0.875rem",
                  backgroundColor: "white",
                  color: "#3b82f6",
                  border: "1px solid #93c5fd",
                  borderRadius: "0.25rem",
                  fontSize: "1.125rem",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                }}
                type="button"
              >
                All Matches
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
};
