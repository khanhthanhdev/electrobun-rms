import { useState } from "react";
import { scoresheetToScoringState } from "@/shared/api/scoring";
import type { MatchType } from "@/shared/types/scoring";
import {
  calcScoringTotal,
  ScoringEntryForm,
} from "../../../features/scoring/components/scoring-entry-form";
import { useAutoSaveScoring } from "../../../features/scoring/hooks/use-auto-save-scoring";
import { useMatchScoresheet } from "../../../features/scoring/hooks/use-match-results";
import { LoadingIndicator } from "../../../shared/components/loading-indicator";

const ALLIANCE_COLOR: Record<"red" | "blue", string> = {
  red: "#dc2626",
  blue: "#0284c7",
};

interface ScoringEntryPageProps {
  alliance: "blue" | "red";
  eventCode: string;
  fieldNumber: string;
  matchNumber: number;
  matchType?: MatchType;
  onNavigate: (path: string) => void;
  token: string | null;
}

export const ScoringEntryPage = ({
  alliance,
  eventCode,
  fieldNumber,
  matchNumber,
  matchType = "quals",
  onNavigate,
  token,
}: ScoringEntryPageProps): JSX.Element => {
  const [lastTotal, setLastTotal] = useState(0);

  const { scoresheet, isLoading } = useMatchScoresheet(
    eventCode,
    matchType,
    matchNumber,
    token,
    true
  );

  const {
    isAutoSaving,
    isSubmitting,
    lastSaveError,
    onScoreChange,
    submitted,
    submitScore,
  } = useAutoSaveScoring({
    alliance,
    eventCode,
    matchNumber,
    matchType,
    token,
  });

  const fieldLabel =
    fieldNumber === "all" ? "All Fields" : `Field ${fieldNumber}`;
  const matchLabel = `Match M${matchNumber}`;
  const allianceLabel = alliance === "red" ? "Red Team" : "Blue Team";
  const accent = ALLIANCE_COLOR[alliance];
  const handleSubmit = (score: Parameters<typeof submitScore>[0]): void => {
    setLastTotal(calcScoringTotal(score));
    submitScore(score);
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

  if (isLoading) {
    return (
      <main className="page-shell page-shell--center">
        <LoadingIndicator />
      </main>
    );
  }

  const allianceData = scoresheet?.[alliance];
  const initialScore = allianceData
    ? scoresheetToScoringState(allianceData)
    : undefined;

  return (
    <main className="page-shell page-shell--top">
      {lastSaveError ? (
        <p className="message-block" data-variant="danger" role="alert">
          {lastSaveError}
        </p>
      ) : null}
      {isAutoSaving || isSubmitting ? (
        <p className="message-block" data-variant="info">
          {isSubmitting ? "Submitting score…" : "Saving…"}
        </p>
      ) : null}
      <ScoringEntryForm
        alliance={alliance}
        embedded={false}
        fieldLabel={fieldLabel}
        initialScore={initialScore}
        key={`${matchNumber}-${alliance}`}
        matchLabel={matchLabel}
        onBackClick={() => window.history.back()}
        onChange={onScoreChange}
        onSubmit={handleSubmit}
      />
    </main>
  );
};
