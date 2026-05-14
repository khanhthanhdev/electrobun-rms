import { useState } from "react";
import { calcScoringTotal } from "@/features/scoring/scoring-business-logic";
import type { MatchType } from "@/shared/types/scoring";
import { ScoringEntryForm } from "../../../features/scoring/components/scoring-entry-form";
import { useScoringEntrySync } from "../../../features/scoring/hooks/use-scoring-entry-sync";
import { useScoringRealtime } from "../../../features/scoring/hooks/use-scoring-realtime";
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
  token: string | null;
}

export const ScoringEntryPage = ({
  alliance,
  eventCode,
  fieldNumber,
  matchNumber,
  matchType = "quals",
  token,
}: ScoringEntryPageProps): JSX.Element => {
  const [lastTotal, setLastTotal] = useState(0);
  useScoringRealtime(eventCode, token);

  const { formProps, isLoading, saveState } = useScoringEntrySync({
    eventCode,
    matchNumber,
    matchType,
    token,
  });
  const allianceFormProps = formProps[alliance];
  const allianceSaveState = saveState[alliance];

  const fieldLabel =
    fieldNumber === "all" ? "All Fields" : `Field ${fieldNumber}`;
  const matchLabel = `Match M${matchNumber}`;
  const allianceLabel = alliance === "red" ? "Red Team" : "Blue Team";
  const accent = ALLIANCE_COLOR[alliance];
  const handleSubmit = (
    score: Parameters<typeof allianceFormProps.onSubmit>[0]
  ): void => {
    setLastTotal(calcScoringTotal(score));
    allianceFormProps.onSubmit(score);
  };

  if (allianceSaveState.submitted) {
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

  return (
    <main className="page-shell page-shell--top">
      {allianceSaveState.lastSaveError ? (
        <p className="message-block" data-variant="danger" role="alert">
          {allianceSaveState.lastSaveError}
        </p>
      ) : null}
      {allianceSaveState.isAutoSaving || allianceSaveState.isSubmitting ? (
        <p className="message-block" data-variant="info">
          {allianceSaveState.isSubmitting ? "Submitting score…" : "Saving…"}
        </p>
      ) : null}
      <ScoringEntryForm
        alliance={alliance}
        embedded={false}
        fieldLabel={fieldLabel}
        initialScore={allianceFormProps.initialScore}
        key={`${matchNumber}-${alliance}`}
        matchLabel={matchLabel}
        onChange={allianceFormProps.onChange}
        onSubmit={handleSubmit}
      />
    </main>
  );
};
