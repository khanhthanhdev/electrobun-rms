import type {
  PostedMatchResult,
  RankingAccumulatorState,
  RankingRules,
} from "../season-rule-types";

const accumulateMatch = (
  _accumulators: Map<number, RankingAccumulatorState>,
  match: PostedMatchResult,
  getOrCreate: (teamNumber: number) => RankingAccumulatorState
): void => {
  const redAcc = getOrCreate(match.redTeam);
  const blueAcc = getOrCreate(match.blueTeam);

  redAcc.matchesPlayed += 1;
  blueAcc.matchesPlayed += 1;

  const redCounts = match.redSurrogate === 0;
  const blueCounts = match.blueSurrogate === 0;

  if (redCounts) {
    redAcc.matchesCounted += 1;
    redAcc.pointsScoredTotal += match.redScore;
  }
  if (blueCounts) {
    blueAcc.matchesCounted += 1;
    blueAcc.pointsScoredTotal += match.blueScore;
  }

  if (match.redScore === match.blueScore) {
    if (redCounts) {
      redAcc.ties += 1;
    }
    if (blueCounts) {
      blueAcc.ties += 1;
    }
    return;
  }

  const redWon = match.redScore > match.blueScore;
  if (redCounts) {
    if (redWon) {
      redAcc.wins += 1;
    } else {
      redAcc.losses += 1;
    }
  }
  if (blueCounts) {
    if (redWon) {
      blueAcc.losses += 1;
    } else {
      blueAcc.wins += 1;
    }
  }
};

const finalize = (accumulator: RankingAccumulatorState): void => {
  accumulator.qualifyingScore = accumulator.wins * 2 + accumulator.ties;
  accumulator.pointsScoredAverage =
    accumulator.matchesCounted > 0
      ? accumulator.pointsScoredTotal / accumulator.matchesCounted
      : 0;
};

const sort = (teams: RankingAccumulatorState[]): RankingAccumulatorState[] =>
  [...teams].sort((left, right) => {
    if (left.qualifyingScore !== right.qualifyingScore) {
      return right.qualifyingScore - left.qualifyingScore;
    }
    if (left.pointsScoredAverage !== right.pointsScoredAverage) {
      return right.pointsScoredAverage - left.pointsScoredAverage;
    }
    if (left.pointsScoredTotal !== right.pointsScoredTotal) {
      return right.pointsScoredTotal - left.pointsScoredTotal;
    }
    return left.teamNumber - right.teamNumber;
  });

const formatSortKey = (value: number, fractionDigits: number): string => {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return value.toFixed(fractionDigits);
};

const buildSortOrders = (team: RankingAccumulatorState): string[] => [
  formatSortKey(team.qualifyingScore, 0),
  formatSortKey(team.pointsScoredAverage, 3),
  formatSortKey(team.pointsScoredTotal, 3),
  String(team.teamNumber).padStart(6, "0"),
  "0",
  "0",
];

export const rankingRules: RankingRules = {
  accumulateMatch,
  finalize,
  sort,
  buildSortOrders,
};
