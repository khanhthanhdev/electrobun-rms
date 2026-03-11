import { useState } from "react";
import { scoresheetToScoringState } from "@/shared/api/scoring";
import { ScoringEntryForm } from "../../../features/scoring/components/scoring-entry-form";
import { useAutoSaveScoring } from "../../../features/scoring/hooks/use-auto-save-scoring";
import { useMatchScoresheet } from "../../../features/scoring/hooks/use-match-results";
import type { ControlMatchRow } from "../../../shared/types/match-control";
import { MatchHistoryEmbed } from "./match-history-embed";
import { MatchScoresheetEmbed } from "./match-scoresheet-embed";

interface ControlActiveMatchPanelProps {
  activeMatchNumber: number | null;
  activeState: "idle" | "in_progress" | "completed";
  eventCode: string;
  onNavigate: (path: string) => void;
  onSelectMatch: (matchNumber: number) => void;
  rows: ControlMatchRow[];
  selectedMatchNumber: number | null;
  timeRemaining: number;
  token: string | null;
}

const toStatusLabel = (state: ControlMatchRow["state"]): string => {
  if (state === "COMMITTED") {
    return "Committed";
  }
  if (state === "INCOMPLETE") {
    return "Incomplete";
  }
  return "Unplayed";
};

const toClockTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const ControlActiveMatchPanel = ({
  activeMatchNumber,
  activeState,
  eventCode,
  onNavigate: _onNavigate,
  rows,
  selectedMatchNumber,
  timeRemaining,
  token,
}: ControlActiveMatchPanelProps): JSX.Element => {
  const [activeTab, setActiveTab] = useState(0);

  const selectedMatch =
    rows.find((row) => row.matchNumber === selectedMatchNumber) ?? rows[0];
  const apiMatchType: "quals" | "elims" =
    selectedMatch.matchType === "elims" ? "elims" : "quals";

  const { scoresheet } = useMatchScoresheet(
    eventCode,
    apiMatchType,
    selectedMatch.matchNumber,
    token,
    rows.length > 0
  );

  const redAutoSave = useAutoSaveScoring({
    alliance: "red",
    eventCode,
    matchNumber: selectedMatch.matchNumber,
    matchType: apiMatchType,
    token,
  });

  const blueAutoSave = useAutoSaveScoring({
    alliance: "blue",
    eventCode,
    matchNumber: selectedMatch.matchNumber,
    matchType: apiMatchType,
    token,
  });

  const redScore = scoresheet?.red?.scoreTotal ?? selectedMatch.redScore ?? 0;
  const blueScore =
    scoresheet?.blue?.scoreTotal ?? selectedMatch.blueScore ?? 0;
  const isLiveScoring =
    redAutoSave.isAutoSaving ||
    redAutoSave.isSubmitting ||
    blueAutoSave.isAutoSaving ||
    blueAutoSave.isSubmitting;

  if (rows.length === 0) {
    return (
      <p className="empty-state">No matches available for this schedule.</p>
    );
  }

  const isActiveMatch =
    activeState === "in_progress" &&
    selectedMatchNumber !== null &&
    selectedMatchNumber === activeMatchNumber;
  const matchLabel = `M${selectedMatch.matchNumber}`;
  const fieldLabel = `Field ${selectedMatch.fieldNumber}`;

  return (
    <section className="match-control-active-panel">
      {/* <label className="match-control-active-select">
        Match
        <select
          onChange={(event) =>
            onSelectMatch(Number.parseInt(event.target.value, 10))
          }
          value={selectedMatch.matchNumber}
        >
          {rows.map((row) => (
            <option key={row.matchName} value={row.matchNumber}>
              {row.matchName} · Field {row.fieldNumber}
            </option>
          ))}
        </select>
      </label> */}

      {isActiveMatch ? (
        <div className="match-control-active-timer">
          <p className="match-control-active-label">Time Remaining</p>
          <p className="match-control-active-value match-control-active-timer-value">
            {formatTime(timeRemaining)}
          </p>
        </div>
      ) : null}

      <div className="match-control-active-summary">
        <div>
          <p className="match-control-active-label">Status</p>
          <p className="match-control-active-value">
            {toStatusLabel(selectedMatch.state)}
          </p>
        </div>
        <div>
          <p className="match-control-active-label">Info</p>
          <p className="match-control-active-value">
            Match {selectedMatch.matchNumber} · Round{" "}
            {selectedMatch.roundNumber} · Field {selectedMatch.fieldNumber}
          </p>
        </div>
        <div>
          <p className="match-control-active-label">Start</p>
          <p className="match-control-active-value">
            {toClockTime(selectedMatch.startTime)}
          </p>
        </div>
      </div>

      <div className="match-control-active-scores">
        <div className="match-control-active-alliance match-control-red-team">
          <p>
            #{selectedMatch.redTeam} {selectedMatch.redTeamName}
          </p>
          <p className="match-control-active-score-value">
            {redScore}
            {isLiveScoring ? (
              <span aria-hidden className="match-control-live-badge">
                {" "}
                LIVE
              </span>
            ) : null}
          </p>
        </div>
        <div className="match-control-active-alliance match-control-blue-team">
          <p>
            #{selectedMatch.blueTeam} {selectedMatch.blueTeamName}
          </p>
          <p className="match-control-active-score-value">
            {blueScore}
            {isLiveScoring ? (
              <span aria-hidden className="match-control-live-badge">
                {" "}
                LIVE
              </span>
            ) : null}
          </p>
        </div>
      </div>

      <div className="match-control-active-tabs">
        <div role="tablist">
          <button
            aria-selected={activeTab === 0}
            onClick={() => setActiveTab(0)}
            role="tab"
            type="button"
          >
            Scoresheet
          </button>
          <button
            aria-selected={activeTab === 1}
            onClick={() => setActiveTab(1)}
            role="tab"
            type="button"
          >
            History
          </button>
          <button
            aria-selected={activeTab === 2}
            onClick={() => setActiveTab(2)}
            role="tab"
            type="button"
          >
            Score Entry
          </button>
        </div>
        <div
          aria-hidden={activeTab !== 0}
          hidden={activeTab !== 0}
          role="tabpanel"
        >
          <MatchScoresheetEmbed
            eventCode={eventCode}
            matchNumber={selectedMatch.matchNumber}
            matchType={selectedMatch.matchType}
            token={token}
          />
        </div>
        <div
          aria-hidden={activeTab !== 1}
          hidden={activeTab !== 1}
          role="tabpanel"
        >
          <MatchHistoryEmbed
            eventCode={eventCode}
            matchName={selectedMatch.matchName}
            matchNumber={selectedMatch.matchNumber}
            matchType={selectedMatch.matchType}
            token={token}
          />
        </div>
        <div
          aria-hidden={activeTab !== 2}
          hidden={activeTab !== 2}
          role="tabpanel"
        >
          {redAutoSave.lastSaveError || blueAutoSave.lastSaveError ? (
            <p className="message-block" data-variant="danger" role="alert">
              {redAutoSave.lastSaveError ?? blueAutoSave.lastSaveError}
            </p>
          ) : null}
          <div className="match-control-score-entry-inline scoresheet-grid-container">
            <ScoringEntryForm
              alliance="red"
              embedded
              fieldLabel={fieldLabel}
              initialScore={
                scoresheet?.red
                  ? scoresheetToScoringState(scoresheet.red)
                  : undefined
              }
              key={`red-${selectedMatch.matchNumber}`}
              matchLabel={matchLabel}
              onChange={redAutoSave.onScoreChange}
              onSubmit={redAutoSave.submitScore}
            />
            <ScoringEntryForm
              alliance="blue"
              embedded
              fieldLabel={fieldLabel}
              initialScore={
                scoresheet?.blue
                  ? scoresheetToScoringState(scoresheet.blue)
                  : undefined
              }
              key={`blue-${selectedMatch.matchNumber}`}
              matchLabel={matchLabel}
              onChange={blueAutoSave.onScoreChange}
              onSubmit={blueAutoSave.submitScore}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
