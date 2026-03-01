export interface OneVsOneScheduleMetrics {
  averageSideImbalance: number;
  backToBackCount: number;
  maxOpponentRepeat: number;
  maxSideImbalance: number;
  repeatOpponentPairs: number;
  surrogateSlots: number;
}

interface OneVsOneMetricsMatch {
  blueSurrogate?: boolean;
  blueTeam: number;
  matchNumber: number;
  redSurrogate?: boolean;
  redTeam: number;
}

const buildPairKey = (teamA: number, teamB: number): string =>
  teamA < teamB ? `${teamA}:${teamB}` : `${teamB}:${teamA}`;

export const EMPTY_ONE_VS_ONE_SCHEDULE_METRICS: OneVsOneScheduleMetrics = {
  averageSideImbalance: 0,
  backToBackCount: 0,
  maxOpponentRepeat: 0,
  maxSideImbalance: 0,
  repeatOpponentPairs: 0,
  surrogateSlots: 0,
};

export const computeOneVsOneScheduleMetrics = (
  matches: OneVsOneMetricsMatch[]
): OneVsOneScheduleMetrics => {
  if (matches.length === 0) {
    return EMPTY_ONE_VS_ONE_SCHEDULE_METRICS;
  }

  const pairCounts = new Map<string, number>();
  const sideCounts = new Map<number, { blue: number; red: number }>();
  const matchesByTeam = new Map<number, number[]>();
  let surrogateSlots = 0;

  for (const match of matches) {
    const pairKey = buildPairKey(match.redTeam, match.blueTeam);
    const previousPairCount = pairCounts.get(pairKey) ?? 0;
    pairCounts.set(pairKey, previousPairCount + 1);

    const redCounter = sideCounts.get(match.redTeam) ?? { blue: 0, red: 0 };
    redCounter.red += 1;
    sideCounts.set(match.redTeam, redCounter);

    const blueCounter = sideCounts.get(match.blueTeam) ?? { blue: 0, red: 0 };
    blueCounter.blue += 1;
    sideCounts.set(match.blueTeam, blueCounter);

    const redMatches = matchesByTeam.get(match.redTeam) ?? [];
    redMatches.push(match.matchNumber);
    matchesByTeam.set(match.redTeam, redMatches);

    const blueMatches = matchesByTeam.get(match.blueTeam) ?? [];
    blueMatches.push(match.matchNumber);
    matchesByTeam.set(match.blueTeam, blueMatches);

    if (match.redSurrogate) {
      surrogateSlots += 1;
    }
    if (match.blueSurrogate) {
      surrogateSlots += 1;
    }
  }

  const repeatCounts = [...pairCounts.values()].filter((count) => count > 1);
  const repeatOpponentPairs = repeatCounts.reduce(
    (total, count) => total + (count - 1),
    0
  );
  const maxOpponentRepeat =
    repeatCounts.length > 0 ? Math.max(...repeatCounts) : 1;

  let maxSideImbalance = 0;
  let totalSideImbalance = 0;
  for (const sideCounter of sideCounts.values()) {
    const imbalance = Math.abs(sideCounter.red - sideCounter.blue);
    maxSideImbalance = Math.max(maxSideImbalance, imbalance);
    totalSideImbalance += imbalance;
  }

  let backToBackCount = 0;
  for (const matchNumbers of matchesByTeam.values()) {
    matchNumbers.sort((left, right) => left - right);
    for (let index = 1; index < matchNumbers.length; index += 1) {
      if (matchNumbers[index] - matchNumbers[index - 1] === 1) {
        backToBackCount += 1;
      }
    }
  }

  return {
    repeatOpponentPairs,
    maxOpponentRepeat,
    maxSideImbalance,
    averageSideImbalance:
      sideCounts.size === 0 ? 0 : totalSideImbalance / sideCounts.size,
    backToBackCount,
    surrogateSlots,
  };
};
