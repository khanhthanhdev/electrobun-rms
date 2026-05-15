import { MATCH_DURATION_SECONDS } from "@shared/match-control";
import {
  SCORE_BREAKDOWN_ROWS,
  SCORING_TOTAL_LABEL,
} from "@/features/scoring/scoring-business-logic";

import { DisplaySceneFooter } from "../components/display-scene-footer";
import { DisplaySceneMatchHeader } from "../components/display-scene-match-header";
import { formatTimer } from "../display-helpers";
import type { ScoreBreakdown } from "../use-display-data";
import { useNow } from "../use-now";

interface MatchStartData {
  blueBreakdown: ScoreBreakdown | null;
  blueScore: number;
  blueTeam: number;
  blueTeamName: string;
  fieldNumber: number;
  matchName: string;
  redBreakdown: ScoreBreakdown | null;
  redScore: number;
  redTeam: number;
  redTeamName: string;
}

interface DisplaySceneMatchStartProps {
  eventName: string;
  isCompleted?: boolean;
  match?: MatchStartData | null;
  matchStartedAtMs?: number | null;
}

const formatHeaderMatchLabel = (
  match: MatchStartData | null | undefined
): string => match?.matchName?.trim().toUpperCase() || "MATCH START";

const formatTeamId = (teamNumber: number | undefined): string =>
  teamNumber ? `ID: #${String(teamNumber).padStart(3, "0")}` : "ID: #TBD";

const formatBoardScore = (score: number): string =>
  String(Math.max(0, score)).padStart(2, "0");

const toBreakdownRows = (
  _blue: ScoreBreakdown | null,
  _red: ScoreBreakdown | null
) => {
  return SCORE_BREAKDOWN_ROWS.filter((row) => {
    // Part B is hidden from this display phase.
    if (row.key === "b") {
      return false;
    }
    return true;
  });
};

const AllianceLiveCard = ({
  alliance,
  className,
  score,
  teamName,
  teamNumber,
}: {
  alliance: "Blue Alliance" | "Red Alliance";
  className: string;
  score: number;
  teamName: string | undefined;
  teamNumber: number | undefined;
}): JSX.Element => (
  <article
    aria-label={`${alliance}: ${teamName?.trim() || "Team pending"}`}
    className={`display-match-preview-card display-match-start-card ${className}`}
  >
    <span className="display-match-preview-team-chip">
      {formatTeamId(teamNumber)}
    </span>
    <p className="display-match-preview-team-name">
      {teamName?.trim() || "Team pending"}
    </p>
    <span className="display-match-preview-team-score">{score}</span>
  </article>
);

export const DisplaySceneMatchStart = ({
  eventName,
  isCompleted = false,
  match,
  matchStartedAtMs,
}: DisplaySceneMatchStartProps): JSX.Element => {
  const now = useNow(1000);
  const elapsedMs = matchStartedAtMs ? now.getTime() - matchStartedAtMs : 0;
  const elapsed = Math.max(0, Math.floor(elapsedMs / 1000));
  const timeRemaining = isCompleted
    ? 0
    : Math.max(0, MATCH_DURATION_SECONDS - elapsed);
  const redScore = match?.redScore ?? 0;
  const blueScore = match?.blueScore ?? 0;
  const redBreakdown = match?.redBreakdown ?? null;
  const blueBreakdown = match?.blueBreakdown ?? null;
  const breakdownRows = toBreakdownRows(blueBreakdown, redBreakdown);

  return (
    <section
      aria-label={`${eventName} live match scene`}
      className="display-sponsors-scene display-match-start-scene"
    >
      <DisplaySceneMatchHeader
        fieldNumber={match?.fieldNumber}
        matchLabel={formatHeaderMatchLabel(match)}
      />

      <div className="display-sponsors-main display-match-start-main">
        <div className="display-match-start-stage">
          <AllianceLiveCard
            alliance="Blue Alliance"
            className="display-match-preview-card--blue"
            score={blueScore}
            teamName={match?.blueTeamName}
            teamNumber={match?.blueTeam}
          />

          <section className="display-match-start-center">
            <div className="display-match-start-countdown">
              <span
                aria-hidden="true"
                className="display-match-start-countdown-icon"
              />
              <span className="display-match-start-countdown-label">
                Match Countdown
              </span>
            </div>

            <span aria-live="polite" className="display-match-start-timer">
              {formatTimer(timeRemaining)}
            </span>

            <section
              aria-label="Match score breakdown"
              className="display-match-start-board"
            >
              {breakdownRows.map(({ key, label }) => (
                <div className="display-match-start-board-row" key={key}>
                  <span className="display-match-start-board-score display-match-start-board-score--blue">
                    {blueBreakdown?.[key] ?? 0}
                  </span>
                  <span className="display-match-start-board-label">
                    {label}
                  </span>
                  <span className="display-match-start-board-score display-match-start-board-score--red">
                    {redBreakdown?.[key] ?? 0}
                  </span>
                </div>
              ))}

              <div className="display-match-start-board-total">
                <span className="display-match-start-board-total-score display-match-start-board-total-score--blue">
                  {formatBoardScore(blueScore)}
                </span>
                <span className="display-match-start-board-total-label">
                  {SCORING_TOTAL_LABEL}
                </span>
                <span className="display-match-start-board-total-score display-match-start-board-total-score--red">
                  {formatBoardScore(redScore)}
                </span>
              </div>
            </section>
          </section>

          <AllianceLiveCard
            alliance="Red Alliance"
            className="display-match-preview-card--red"
            score={redScore}
            teamName={match?.redTeamName}
            teamNumber={match?.redTeam}
          />
        </div>
      </div>

      <DisplaySceneFooter />
    </section>
  );
};
