import { createElement, useState } from "react";
import { ScoringEntryForm } from "../../../features/scoring/components/scoring-entry-form";
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

  if (rows.length === 0) {
    return (
      <p className="empty-state">No matches available for this schedule.</p>
    );
  }

  const selectedMatch =
    rows.find((row) => row.matchNumber === selectedMatchNumber) ?? rows[0];
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
        </div>
        <div className="match-control-active-alliance match-control-blue-team">
          <p>
            #{selectedMatch.blueTeam} {selectedMatch.blueTeamName}
          </p>
        </div>
      </div>

      {createElement(
        "ot-tabs",
        { className: "match-control-active-tabs" },
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
        </div>,
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
        </div>,
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
        </div>,
        <div
          aria-hidden={activeTab !== 2}
          hidden={activeTab !== 2}
          role="tabpanel"
        >
          <div className="match-control-score-entry-inline scoresheet-grid-container">
            <ScoringEntryForm
              alliance="red"
              embedded
              fieldLabel={fieldLabel}
              matchLabel={matchLabel}
              onSubmit={() => {
                /* TODO: API integration */
              }}
            />
            <ScoringEntryForm
              alliance="blue"
              embedded
              fieldLabel={fieldLabel}
              matchLabel={matchLabel}
              onSubmit={() => {
                /* TODO: API integration */
              }}
            />
          </div>
        </div>
      )}
    </section>
  );
};
