import { useState } from "react";
import {
  calcScoringTotal,
  ScoringEntryForm,
} from "../../../features/scoring/components/scoring-entry-form";

const ALLIANCE_COLOR: Record<"red" | "blue", string> = {
  red: "#dc2626",
  blue: "#0284c7",
};

interface ScoringEntryPageProps {
  alliance: "blue" | "red";
  eventCode: string;
  fieldNumber: string;
  matchNumber: number;
  onNavigate: (path: string) => void;
}

export const ScoringEntryPage = ({
  alliance,
  eventCode,
  fieldNumber,
  matchNumber,
  onNavigate,
}: ScoringEntryPageProps): JSX.Element => {
  const [submitted, setSubmitted] = useState(false);
  const [lastTotal, setLastTotal] = useState(0);

  const fieldLabel =
    fieldNumber === "all" ? "All Fields" : `Field ${fieldNumber}`;
  const matchLabel = `Match M${matchNumber}`;
  const allianceLabel = alliance === "red" ? "Red Alliance" : "Blue Alliance";
  const accent = ALLIANCE_COLOR[alliance];
  const selectionPath =
    alliance === "red"
      ? `/event/${eventCode}/ref/red/scoring`
      : `/event/${eventCode}/ref/blue/scoring`;

  const handleSubmit = (total: number): void => {
    // TODO: POST score to API — placeholder logs for now
    setLastTotal(total);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <main className="page-shell page-shell--center">
        <div className="surface-card surface-card--small">
          <div
            className="card"
            style={{ textAlign: "center", padding: "2rem 1.5rem" }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1rem",
                fontSize: "1.5rem",
                color: "#fff",
              }}
            >
              ✓
            </div>
            <h2
              className="app-heading"
              style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}
            >
              Score Submitted
            </h2>
            <p className="app-subheading" style={{ marginBottom: "1.5rem" }}>
              {allianceLabel} · {matchLabel} · {fieldLabel}
            </p>
            <p
              style={{
                fontSize: "2rem",
                fontWeight:
                  "var(--font-bold)" as React.CSSProperties["fontWeight"],
                color: accent,
                margin: "0 0 1.5rem",
              }}
            >
              {lastTotal} pts
            </p>
            <button
              onClick={() =>
                onNavigate(
                  `/event/${eventCode}/ref/${alliance}/scoring/${fieldNumber}`
                )
              }
              style={{
                padding: "0.75rem 2rem",
                backgroundColor: accent,
                color: "#fff",
                border: "none",
                borderRadius: "var(--radius-medium)",
                fontSize: "0.95rem",
                cursor: "pointer",
                fontWeight:
                  "var(--font-semibold)" as React.CSSProperties["fontWeight"],
                width: "100%",
              }}
              type="button"
            >
              Back to Match List
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell page-shell--top">
      <ScoringEntryForm
        alliance={alliance}
        embedded={false}
        fieldLabel={fieldLabel}
        matchLabel={matchLabel}
        onBackClick={() => onNavigate(selectionPath)}
        onSubmit={(score) => handleSubmit(calcScoringTotal(score))}
      />
    </main>
  );
};
