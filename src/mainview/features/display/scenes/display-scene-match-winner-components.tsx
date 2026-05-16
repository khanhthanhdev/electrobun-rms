import matchPreviewTrophyIcon from "@/assets/display-sponsors/match-preview-trophy-icon.svg";
import {
  PENALTY_SCORING_FIELD,
  SCORE_BREAKDOWN_ROWS,
  SCORING_TOTAL_LABEL,
} from "@/features/scoring/scoring-business-logic";

import { DisplayScoreLabel } from "../components/display-score-label";
import type { ScoreBreakdown } from "../use-display-data";

export const formatTeamId = (teamNumber: number | undefined): string =>
  teamNumber ? `T${String(teamNumber).padStart(2, "0")}` : "TBD";

export const formatTeamName = (teamName: string | undefined): string =>
  teamName?.trim() || "Team pending";

const formatScore = (score: number): string => String(Math.max(0, score));

const WINNER_BREAKDOWN_ROWS = SCORE_BREAKDOWN_ROWS.filter(
  ({ key }) => key !== "b"
);

const WINNER_DISPLAY_ROWS = [
  ...WINNER_BREAKDOWN_ROWS,
  { key: "penalty" as const, label: PENALTY_SCORING_FIELD.label },
];

const formatBreakdownScore = (
  key: keyof ScoreBreakdown,
  value: number | undefined
): string => {
  const score = value ?? 0;
  return key === "penalty" && score > 0 ? `-${score}` : String(score);
};

const ScoreBadge = ({
  alliance,
  children,
  isTotal = false,
}: {
  alliance: "blue" | "red";
  children: React.ReactNode;
  isTotal?: boolean;
}): JSX.Element => (
  <span
    className={`display-winner-score-badge display-winner-score-badge--${alliance} ${
      isTotal ? "display-winner-score-badge--total" : ""
    }`}
  >
    {children}
  </span>
);

export const DisplayWinnerBreakdown = ({
  blue,
  blueScore,
  red,
  redScore,
}: {
  blue: ScoreBreakdown | null;
  blueScore: number;
  red: ScoreBreakdown | null;
  redScore: number;
}): JSX.Element => (
  <section
    aria-label="Match score details"
    className="display-winner-breakdown"
  >
    {WINNER_DISPLAY_ROWS.map(({ key, label }) => (
      <div className="display-winner-breakdown-row" key={key}>
        <div className="display-winner-breakdown-cell display-winner-breakdown-cell--red">
          <ScoreBadge alliance="red">
            {formatBreakdownScore(key, red?.[key])}
          </ScoreBadge>
        </div>
        <DisplayScoreLabel className="display-winner-breakdown-label">
          {label}
        </DisplayScoreLabel>
        <div className="display-winner-breakdown-cell display-winner-breakdown-cell--blue">
          <ScoreBadge alliance="blue">
            {formatBreakdownScore(key, blue?.[key])}
          </ScoreBadge>
        </div>
      </div>
    ))}

    <div className="display-winner-breakdown-row display-winner-breakdown-total">
      <div className="display-winner-breakdown-cell display-winner-breakdown-cell--red">
        <ScoreBadge alliance="red" isTotal>
          {formatScore(redScore)}
        </ScoreBadge>
      </div>
      <DisplayScoreLabel className="display-winner-breakdown-total-label">
        {SCORING_TOTAL_LABEL}
      </DisplayScoreLabel>
      <div className="display-winner-breakdown-cell display-winner-breakdown-cell--blue">
        <ScoreBadge alliance="blue" isTotal>
          {formatScore(blueScore)}
        </ScoreBadge>
      </div>
    </div>
  </section>
);

export const DisplayWinnerAllianceCard = ({
  alliance,
  isTie,
  isWinner,
  score,
  teamName,
  teamNumber,
}: {
  alliance: "blue" | "red";
  isTie: boolean;
  isWinner: boolean;
  score: number;
  teamName: string | undefined;
  teamNumber: number | undefined;
}): JSX.Element => (
  <article
    aria-label={`${alliance === "red" ? "Red" : "Blue"} alliance result`}
    className={`display-winner-alliance-card display-winner-alliance-card--${alliance} ${
      isWinner ? "display-winner-alliance-card--won" : ""
    }`}
  >
    <span className="display-winner-team-chip">{formatTeamId(teamNumber)}</span>
    <p className="display-winner-team-name">{formatTeamName(teamName)}</p>
    <span className="display-winner-team-score">{formatScore(score)}</span>
    {isWinner || isTie ? (
      <span className="display-winner-result-badge">
        <img
          alt=""
          className="display-winner-result-badge-icon"
          height={62}
          src={matchPreviewTrophyIcon}
          width={62}
        />
        {isTie ? "Hòa điểm" : "Chiến thắng"}
      </span>
    ) : null}
  </article>
);
