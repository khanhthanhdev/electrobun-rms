import { DisplaySceneFooter } from "../components/display-scene-footer";
import { DisplaySceneHeader } from "../components/display-scene-header";
import type { ScoreBreakdown } from "../use-display-data";
import {
  DisplayWinnerAllianceCard,
  DisplayWinnerBreakdown,
} from "./display-scene-match-winner-components";

interface MatchWinnerData {
  blueBreakdown: ScoreBreakdown | null;
  blueScore: number;
  blueTeam: number;
  blueTeamName: string;
  matchName: string;
  redBreakdown: ScoreBreakdown | null;
  redScore: number;
  redTeam: number;
  redTeamName: string;
}

interface DisplaySceneMatchWinnerProps {
  eventName: string;
  match?: MatchWinnerData | null;
  matchStartedAtMs?: number | null;
}

const formatHeaderMatchLabel = (
  match: MatchWinnerData | null | undefined
): string => match?.matchName?.trim().toUpperCase() || "MATCH RESULTS";

export const DisplaySceneMatchWinner = ({
  eventName,
  match,
}: DisplaySceneMatchWinnerProps): JSX.Element => {
  const redScore = match?.redScore ?? 0;
  const blueScore = match?.blueScore ?? 0;
  const isTie = redScore === blueScore;
  const redWon = !isTie && redScore > blueScore;
  const blueWon = !isTie && blueScore > redScore;
  return (
    <section
      aria-label={`${eventName} match results scene`}
      className="display-sponsors-scene display-winner-scene"
    >
      <DisplaySceneHeader title={formatHeaderMatchLabel(match)} />

      <main className="display-sponsors-main display-winner-main">
        <div className="display-winner-content">
          <div className="display-winner-score-row">
            <DisplayWinnerAllianceCard
              alliance="red"
              isTie={isTie}
              isWinner={redWon}
              score={redScore}
              teamName={match?.redTeamName}
              teamNumber={match?.redTeam}
            />

            <div aria-hidden="true" className="display-winner-divider">
              <span className="display-winner-divider-line display-winner-divider-line--red" />
              <span className="display-winner-divider-dot" />
              <span className="display-winner-divider-line display-winner-divider-line--blue" />
            </div>

            <DisplayWinnerAllianceCard
              alliance="blue"
              isTie={isTie}
              isWinner={blueWon}
              score={blueScore}
              teamName={match?.blueTeamName}
              teamNumber={match?.blueTeam}
            />
          </div>

          <DisplayWinnerBreakdown
            blue={match?.blueBreakdown ?? null}
            blueScore={blueScore}
            red={match?.redBreakdown ?? null}
            redScore={redScore}
          />
        </div>
      </main>

      <DisplaySceneFooter />
    </section>
  );
};
