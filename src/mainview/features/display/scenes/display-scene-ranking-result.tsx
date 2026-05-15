import { DisplaySceneFooter } from "../components/display-scene-footer";
import { DisplaySceneHeader } from "../components/display-scene-header";

interface RankingRow {
  rank: number;
  rp: number;
  teamName: string;
  teamNumber: number;
  total: number;
  winPct: string;
  wlt: string;
}

interface DisplaySceneRankingResultProps {
  eventName: string;
  matchesPlayed?: string;
  rankings?: RankingRow[];
}

const DISPLAYED_RANKING_COUNT = 4;

const getRankClassName = (rank: number): string => {
  if (rank === 1) {
    return "display-ranking-rank-badge display-ranking-rank-badge--gold";
  }

  if (rank === 2) {
    return "display-ranking-rank-badge display-ranking-rank-badge--silver";
  }

  return "display-ranking-rank-badge";
};

const formatDecimal = (value: number): string => value.toFixed(2);

const getPlays = (wlt: string): number =>
  wlt
    .split("-")
    .map((value) => Number.parseInt(value, 10))
    .filter(Number.isFinite)
    .reduce((total, value) => total + value, 0);

export const DisplaySceneRankingResult = ({
  eventName,
  rankings = [],
}: DisplaySceneRankingResultProps): JSX.Element => {
  const displayedRankings = rankings.slice(0, DISPLAYED_RANKING_COUNT);

  return (
    <section
      aria-label={`${eventName} ranking results scene`}
      className="display-sponsors-scene display-ranking-result-scene"
    >
      <DisplaySceneHeader title="Rankings" />

      <main className="display-sponsors-main display-ranking-main">
        <section className="display-ranking-card" aria-label="Team rankings">
          <div aria-hidden="true" className="display-ranking-card-glow" />

          <div className="display-ranking-grid display-ranking-grid--header">
            <span>Rank</span>
            <span>Team</span>
            <span>RS</span>
            <span>Points</span>
            <span>Base</span>
            <span>Plays</span>
          </div>

          {displayedRankings.length > 0 ? (
            <div className="display-ranking-list">
              {displayedRankings.map((row) => (
                <div className="display-ranking-grid" key={row.teamNumber}>
                  <span className={getRankClassName(row.rank)}>
                    {row.rank}
                  </span>
                  <span className="display-ranking-team-badge">
                    {row.teamNumber}
                  </span>
                  <span className="display-ranking-value">
                    {formatDecimal(row.rp)}
                  </span>
                  <span className="display-ranking-value display-ranking-value--strong">
                    {formatDecimal(row.total)}
                  </span>
                  <span className="display-ranking-value">0.00</span>
                  <span className="display-ranking-plays-badge">
                    {getPlays(row.wlt)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="display-ranking-empty">No rankings yet</div>
          )}
        </section>
      </main>

      <DisplaySceneFooter />
    </section>
  );
};
