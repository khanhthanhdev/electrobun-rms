import { useState } from "react";
import {
  type MatchRef,
  matchRefEquals,
  toMatchRef,
} from "@/features/events/control/match-control-session";
import { scoresheetToScoringState } from "@/shared/api/scoring";
import { ScoringEntryForm } from "../../../features/scoring/components/scoring-entry-form";
import { useAutoSaveScoring } from "../../../features/scoring/hooks/use-auto-save-scoring";
import { useMatchScoresheet } from "../../../features/scoring/hooks/use-match-results";
import type { ControlMatchRow } from "../../../shared/types/match-control";
import { MatchHistoryEmbed } from "./match-history-embed";
import { MatchScoresheetEmbed } from "./match-scoresheet-embed";

interface ControlActiveMatchPanelProps {
  activeMatch: ControlMatchRow | null;
  activeMatchRef: MatchRef | null;
  activeState: "idle" | "in_progress" | "completed";
  eventCode: string;
  onNavigate: (path: string) => void;
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

const renderLiveBadge = (isVisible: boolean): JSX.Element | null => {
  if (!isVisible) {
    return null;
  }

  return (
    <span aria-hidden className="match-control-live-badge">
      {" "}
      LIVE
    </span>
  );
};

export const ControlActiveMatchPanel = ({
  activeMatch,
  activeMatchRef,
  activeState,
  eventCode,
  onNavigate: _onNavigate,
  timeRemaining,
  token,
}: ControlActiveMatchPanelProps): JSX.Element => {
  const [activeTab, setActiveTab] = useState(0);
  const selectedMatch = activeMatch;
  const matchType = selectedMatch?.matchType ?? "quals";
  const matchNumber = selectedMatch?.matchNumber ?? 0;
  const hasActiveMatch = selectedMatch !== null;

  const { scoresheet } = useMatchScoresheet(
    eventCode,
    matchType,
    matchNumber,
    token,
    hasActiveMatch
  );

  const redAutoSave = useAutoSaveScoring({
    alliance: "red",
    eventCode,
    matchNumber,
    matchType,
    token,
  });

  const blueAutoSave = useAutoSaveScoring({
    alliance: "blue",
    eventCode,
    matchNumber,
    matchType,
    token,
  });

  if (!selectedMatch) {
    return <p className="empty-state">No active match.</p>;
  }

  const redScore = scoresheet?.red?.scoreTotal ?? selectedMatch.redScore ?? 0;
  const blueScore =
    scoresheet?.blue?.scoreTotal ?? selectedMatch.blueScore ?? 0;
  const isLiveScoring =
    redAutoSave.isAutoSaving ||
    redAutoSave.isSubmitting ||
    blueAutoSave.isAutoSaving ||
    blueAutoSave.isSubmitting;

  const isActiveMatch =
    activeState === "in_progress" &&
    matchRefEquals(toMatchRef(selectedMatch), activeMatchRef);
  const matchLabel = `M${selectedMatch.matchNumber}`;
  const fieldLabel = `Field ${selectedMatch.fieldNumber}`;

  return (
    <section className="match-control-active-panel">
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
        <div className="match-control-active-alliance match-control-blue-team">
          <p>
            #{selectedMatch.blueTeam} {selectedMatch.blueTeamName}
          </p>
          <p className="match-control-active-score-value">
            {blueScore}
            {renderLiveBadge(isLiveScoring)}
          </p>
        </div>
        <div className="match-control-active-alliance match-control-red-team">
          <p>
            #{selectedMatch.redTeam} {selectedMatch.redTeamName}
          </p>
          <p className="match-control-active-score-value">
            {redScore}
            {renderLiveBadge(isLiveScoring)}
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
            Score Entry
          </button>
          <button
            aria-selected={activeTab === 1}
            onClick={() => setActiveTab(1)}
            role="tab"
            type="button"
          >
            Scoresheet
          </button>
          <button
            aria-selected={activeTab === 2}
            onClick={() => setActiveTab(2)}
            role="tab"
            type="button"
          >
            History
          </button>
        </div>
        <div
          aria-hidden={activeTab !== 0}
          hidden={activeTab !== 0}
          role="tabpanel"
        >
          {redAutoSave.lastSaveError || blueAutoSave.lastSaveError ? (
            <p className="message-block" data-variant="danger" role="alert">
              {redAutoSave.lastSaveError ?? blueAutoSave.lastSaveError}
            </p>
          ) : null}
          <div className="match-control-score-entry-inline scoresheet-grid-container">
            <ScoringEntryForm
              alliance="blue"
              embedded
              fieldLabel={fieldLabel}
              initialScore={
                scoresheet?.blue
                  ? scoresheetToScoringState(scoresheet.blue)
                  : undefined
              }
              key={`blue-${selectedMatch.matchType}-${selectedMatch.matchNumber}`}
              matchLabel={matchLabel}
              onChange={blueAutoSave.onScoreChange}
              onSubmit={blueAutoSave.submitScore}
            />
            <ScoringEntryForm
              alliance="red"
              embedded
              fieldLabel={fieldLabel}
              initialScore={
                scoresheet?.red
                  ? scoresheetToScoringState(scoresheet.red)
                  : undefined
              }
              key={`red-${selectedMatch.matchType}-${selectedMatch.matchNumber}`}
              matchLabel={matchLabel}
              onChange={redAutoSave.onScoreChange}
              onSubmit={redAutoSave.submitScore}
            />
          </div>
        </div>
        <div
          aria-hidden={activeTab !== 1}
          hidden={activeTab !== 1}
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
          aria-hidden={activeTab !== 2}
          hidden={activeTab !== 2}
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
      </div>
    </section>
  );
};
