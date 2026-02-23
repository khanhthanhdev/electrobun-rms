export interface RankingTableRow {
  losses: number;
  name: string;
  played: number;
  rank: number;
  rankingPoint: number;
  teamNumber: number;
  ties: number;
  total: number;
  wins: number;
}

interface RankingTableProps {
  emptyMessage: string;
  rows: RankingTableRow[];
}

const formatNumber = (value: number): string => value.toFixed(2);

const formatRecord = ({
  losses,
  ties,
  wins,
}: {
  losses: number;
  ties: number;
  wins: number;
}): string => `${wins}-${losses}-${ties}`;

export const RankingTable = ({
  emptyMessage,
  rows,
}: RankingTableProps): JSX.Element => {
  if (rows.length === 0) {
    return <p className="form-note">{emptyMessage}</p>;
  }

  return (
    <table className="schedule-table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Team #</th>
          <th>Name</th>
          <th>RP</th>
          <th>Total</th>
          <th>W-L-T</th>
          <th>Played</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.teamNumber}>
            <td>{row.rank}</td>
            <td>{row.teamNumber}</td>
            <td>{row.name || "-"}</td>
            <td>{formatNumber(row.rankingPoint)}</td>
            <td>{formatNumber(row.total)}</td>
            <td>
              {formatRecord({
                losses: row.losses,
                ties: row.ties,
                wins: row.wins,
              })}
            </td>
            <td>{row.played}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
