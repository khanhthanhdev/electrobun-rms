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

export const DisplaySceneRankingResult = ({
  eventName,
  rankings = [],
  matchesPlayed = "0 / 0 matches played",
}: DisplaySceneRankingResultProps): JSX.Element => (
  <div className="display-scene display-scene-ranking-result">
    <section className="display-ranking-header">
      <table className="display-ranking-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Team</th>
            <th>Name</th>
            <th>RP</th>
            <th>Total</th>
            <th>W-L-T</th>
            <th>% Win</th>
          </tr>
        </thead>
        <tbody>
          {rankings.length > 0 ? (
            rankings.map((row) => (
              <tr key={row.teamNumber}>
                <td>{row.rank}</td>
                <td>{row.teamNumber}</td>
                <td>{row.teamName}</td>
                <td>{row.rp}</td>
                <td>{row.total}</td>
                <td>{row.wlt}</td>
                <td>{row.winPct}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7}>No rankings yet</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
    <footer className="display-ranking-footer">
      <span>{matchesPlayed}</span>
      <span>{eventName}</span>
    </footer>
  </div>
);
