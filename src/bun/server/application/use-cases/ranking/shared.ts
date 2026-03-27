import {
  getActiveSeasonRules,
  type RankingAccumulatorState,
} from "../../../domain/season-rules";
import { ApplicationError } from "../../common/application-error";
import type {
  PersistedTeamRankingSnapshot,
  PostedQualificationMatch,
  QualificationRankingItem,
  QualificationRankingSourceFingerprintInput,
  RankingTeam,
  TeamRankingRowToPersist,
} from "../../dtos/ranking";

interface TeamRankingAccumulator extends RankingAccumulatorState {
  fmsTeamId: string;
  name: string;
}

const SYNTHETIC_FMS_TEAM_ID_PREFIX = "LOCAL_TEAM_";

const buildSyntheticFmsTeamId = (teamNumber: number): string =>
  `${SYNTHETIC_FMS_TEAM_ID_PREFIX}${teamNumber}`;

const parseNumericValue = (value: number | string | null): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const parsedValue = Number.parseFloat(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
};

const formatFixedDecimal = (value: number): string =>
  Number.isFinite(value) ? value.toFixed(3) : "0.000";

const createAccumulator = (team: RankingTeam): TeamRankingAccumulator => ({
  teamNumber: team.teamNumber,
  fmsTeamId: team.fmsTeamId || buildSyntheticFmsTeamId(team.teamNumber),
  name: team.name.trim() || `Team ${team.teamNumber}`,
  wins: 0,
  losses: 0,
  ties: 0,
  matchesPlayed: 0,
  matchesCounted: 0,
  qualifyingScore: 0,
  pointsScoredTotal: 0,
  pointsScoredAverage: 0,
});

const getOrCreateAccumulator = (
  accumulatorsByTeamNumber: Map<number, TeamRankingAccumulator>,
  teamNumber: number
): TeamRankingAccumulator => {
  const existing = accumulatorsByTeamNumber.get(teamNumber);
  if (existing) {
    return existing;
  }

  const created = createAccumulator({
    teamNumber,
    fmsTeamId: buildSyntheticFmsTeamId(teamNumber),
    name: `Team ${teamNumber}`,
  });
  accumulatorsByTeamNumber.set(teamNumber, created);
  return created;
};

const toQualificationRankingItems = (
  accumulators: TeamRankingAccumulator[]
): QualificationRankingItem[] =>
  accumulators.map((accumulator, index) => ({
    rank: index + 1,
    teamNumber: accumulator.teamNumber,
    name: accumulator.name,
    rankingPoint: accumulator.qualifyingScore,
    total: accumulator.pointsScoredTotal,
    wins: accumulator.wins,
    losses: accumulator.losses,
    ties: accumulator.ties,
    played: accumulator.matchesPlayed,
  }));

const buildRowsToPersist = (
  eventCode: string,
  accumulators: TeamRankingAccumulator[],
  existingRows: PersistedTeamRankingSnapshot[]
): TeamRankingRowToPersist[] => {
  const seasonRules = getActiveSeasonRules();
  const rankByTeamId = new Map(
    existingRows.map((row) => [row.fmsTeamId, row.rank] as const)
  );
  const averageByTeamId = new Map(
    existingRows.map(
      (row) =>
        [row.fmsTeamId, parseNumericValue(row.pointsScoredAverage)] as const
    )
  );
  const fmsEventId =
    existingRows.find((row) => row.fmsEventId?.trim())?.fmsEventId ?? eventCode;
  const modifiedOn = new Date().toISOString();

  return accumulators.map((accumulator, index) => {
    const ranking = index + 1;
    const previousRank = rankByTeamId.get(accumulator.fmsTeamId);
    const previousAverage = averageByTeamId.get(accumulator.fmsTeamId) ?? 0;
    const sortOrders = seasonRules.ranking.buildSortOrders(accumulator);

    return {
      fmsEventId,
      fmsTeamId: accumulator.fmsTeamId,
      ranking,
      rankChange:
        previousRank === undefined ? 0 : Math.trunc(previousRank - ranking),
      wins: accumulator.wins,
      losses: accumulator.losses,
      ties: accumulator.ties,
      qualifyingScore: String(accumulator.qualifyingScore),
      pointsScoredTotal: accumulator.pointsScoredTotal,
      pointsScoredAverage: formatFixedDecimal(accumulator.pointsScoredAverage),
      pointsScoredAverageChange: Math.round(
        (accumulator.pointsScoredAverage - previousAverage) * 1000
      ),
      matchesPlayed: accumulator.matchesPlayed,
      matchesCounted: accumulator.matchesCounted,
      disqualified: 0,
      sortOrder1: sortOrders[0] ?? "0",
      sortOrder2: sortOrders[1] ?? "0",
      sortOrder3: sortOrders[2] ?? "0",
      sortOrder4: sortOrders[3] ?? "0",
      sortOrder5: sortOrders[4] ?? "0",
      sortOrder6: sortOrders[5] ?? "0",
      modifiedOn,
    };
  });
};

export const normalizeRankingEventCode = (eventCode: string): string => {
  const normalizedEventCode = eventCode.trim();
  if (!normalizedEventCode) {
    throw new ApplicationError("Event code is required.", 400);
  }

  if (
    normalizedEventCode.includes("/") ||
    normalizedEventCode.includes("\\") ||
    normalizedEventCode.includes("..")
  ) {
    throw new ApplicationError(
      `Invalid event code "${normalizedEventCode}".`,
      400
    );
  }

  return normalizedEventCode;
};

export const buildQualificationRankingSourceFingerprint = (
  input: QualificationRankingSourceFingerprintInput
): string => {
  if (!input.hasPostedSourceTables) {
    return `teams=${input.teamCount}|lineups=${input.lineupsCount}|matches=0|maxPostedTime=0|scores=0|penalties=0|signature=0`;
  }

  return [
    `teams=${input.teamCount}`,
    `lineups=${input.lineupsCount}`,
    `matches=${input.source.matchCount}`,
    `maxPostedTime=${input.source.maxPostedTime}`,
    `redScoreSum=${input.source.redScoreSum}`,
    `blueScoreSum=${input.source.blueScoreSum}`,
    `redPenaltyCommittedSum=${input.source.redPenaltyCommittedSum}`,
    `bluePenaltyCommittedSum=${input.source.bluePenaltyCommittedSum}`,
    `signature=${input.source.weightedSignature}`,
  ].join("|");
};

export const computeQualificationRankingSnapshot = (input: {
  eventCode: string;
  existingRows: PersistedTeamRankingSnapshot[];
  matches: PostedQualificationMatch[];
  teams: RankingTeam[];
}): {
  persistedRows: TeamRankingRowToPersist[];
  rankings: QualificationRankingItem[];
} => {
  const seasonRules = getActiveSeasonRules();
  const accumulatorsByTeamNumber = new Map<number, TeamRankingAccumulator>();

  for (const team of input.teams) {
    accumulatorsByTeamNumber.set(team.teamNumber, createAccumulator(team));
  }

  for (const match of input.matches) {
    if (match.postedTime <= 0) {
      continue;
    }

    seasonRules.ranking.accumulateMatch(
      accumulatorsByTeamNumber as Map<number, RankingAccumulatorState>,
      match,
      (teamNumber) =>
        getOrCreateAccumulator(accumulatorsByTeamNumber, teamNumber)
    );
  }

  const accumulators = Array.from(accumulatorsByTeamNumber.values());
  for (const accumulator of accumulators) {
    seasonRules.ranking.finalize(accumulator);
  }

  const sortedAccumulators = seasonRules.ranking.sort(
    accumulators
  ) as TeamRankingAccumulator[];

  return {
    rankings: toQualificationRankingItems(sortedAccumulators),
    persistedRows: buildRowsToPersist(
      input.eventCode,
      sortedAccumulators,
      input.existingRows
    ),
  };
};
