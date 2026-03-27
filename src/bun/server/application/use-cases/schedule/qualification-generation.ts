import type {
  OneVsOneScheduleMatch,
  QualificationMetrics,
} from "../../dtos/schedule";
import {
  calculateRestPenalty,
  computeMatchTimes,
  MIN_REST_GAP,
} from "./shared";

interface PairingEntry {
  isSurrogate: boolean;
  teamNumber: number;
}

interface SideCounter {
  blue: number;
  red: number;
}

interface SideAssignment {
  blue: PairingEntry;
  red: PairingEntry;
}

export const EMPTY_QUALIFICATION_METRICS: QualificationMetrics = {
  averageSideImbalance: 0,
  backToBackCount: 0,
  maxOpponentRepeat: 0,
  maxSideImbalance: 0,
  repeatOpponentPairs: 0,
  surrogateSlots: 0,
};

const createPairKey = (teamA: number, teamB: number): string =>
  teamA < teamB ? `${teamA}:${teamB}` : `${teamB}:${teamA}`;

const createSeededRandom = (seed: number): (() => number) => {
  const modulus = 2_147_483_647;
  const multiplier = 48_271;
  let randomState = Math.abs(Math.trunc(seed)) % modulus;
  if (randomState === 0) {
    randomState = 1;
  }

  return () => {
    randomState = (randomState * multiplier) % modulus;
    return randomState / modulus;
  };
};

const buildRemainingCountsByTeam = (
  entries: PairingEntry[]
): Map<number, number> => {
  const remainingCounts = new Map<number, number>();
  for (const entry of entries) {
    remainingCounts.set(
      entry.teamNumber,
      (remainingCounts.get(entry.teamNumber) ?? 0) + 1
    );
  }
  return remainingCounts;
};

const getSideCounter = (
  sideCounts: Map<number, SideCounter>,
  teamNumber: number
): SideCounter => sideCounts.get(teamNumber) ?? { red: 0, blue: 0 };

const sideImbalanceDelta = (
  counter: SideCounter,
  side: "blue" | "red"
): number => {
  const nextRedCount = counter.red + (side === "red" ? 1 : 0);
  const nextBlueCount = counter.blue + (side === "blue" ? 1 : 0);
  return Math.abs(nextRedCount - nextBlueCount);
};

const chooseSideAssignment = (
  first: PairingEntry,
  second: PairingEntry,
  sideCounts: Map<number, SideCounter>,
  random: () => number
): SideAssignment => {
  const firstCounts = getSideCounter(sideCounts, first.teamNumber);
  const secondCounts = getSideCounter(sideCounts, second.teamNumber);
  const firstAsRedCost =
    sideImbalanceDelta(firstCounts, "red") +
    sideImbalanceDelta(secondCounts, "blue");
  const secondAsRedCost =
    sideImbalanceDelta(firstCounts, "blue") +
    sideImbalanceDelta(secondCounts, "red");

  if (firstAsRedCost < secondAsRedCost) {
    return { red: first, blue: second };
  }
  if (secondAsRedCost < firstAsRedCost) {
    return { red: second, blue: first };
  }

  return random() < 0.5
    ? { red: first, blue: second }
    : { red: second, blue: first };
};

const chooseEntryIndex = (
  entries: PairingEntry[],
  random: () => number,
  currentRound: number,
  lastRoundByTeam: Map<number, number>
): number => {
  const remainingCounts = buildRemainingCountsByTeam(entries);
  let bestIndex = 0;
  let bestScore = -Number.POSITIVE_INFINITY;

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const remainingCount = remainingCounts.get(entry.teamNumber) ?? 0;
    const surrogatePenalty = entry.isSurrogate ? 0.4 : 0;
    const lastRound = lastRoundByTeam.get(entry.teamNumber);
    const roundGap =
      lastRound === undefined
        ? Number.POSITIVE_INFINITY
        : currentRound - lastRound;
    const restPenalty =
      roundGap <= MIN_REST_GAP ? (MIN_REST_GAP + 1 - roundGap) * 10 : 0;
    const score =
      remainingCount - surrogatePenalty - restPenalty + random() * 0.001;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestIndex;
};

const calculateOpponentCost = (options: {
  candidate: PairingEntry;
  currentRound: number;
  first: PairingEntry;
  lastRoundByTeam: Map<number, number>;
  pairCounts: Map<string, number>;
  random: () => number;
  sideCounts: Map<number, SideCounter>;
}): number => {
  const pairKey = createPairKey(
    options.first.teamNumber,
    options.candidate.teamNumber
  );
  const assignment = chooseSideAssignment(
    options.first,
    options.candidate,
    options.sideCounts,
    options.random
  );
  return (
    (options.pairCounts.get(pairKey) ?? 0) * 100 +
    calculateRestPenalty(
      options.currentRound,
      options.lastRoundByTeam,
      options.first.teamNumber
    ) +
    calculateRestPenalty(
      options.currentRound,
      options.lastRoundByTeam,
      options.candidate.teamNumber
    ) +
    sideImbalanceDelta(
      getSideCounter(options.sideCounts, assignment.red.teamNumber),
      "red"
    ) +
    sideImbalanceDelta(
      getSideCounter(options.sideCounts, assignment.blue.teamNumber),
      "blue"
    ) +
    (options.first.isSurrogate && options.candidate.isSurrogate ? 25 : 0) +
    options.random() * 0.01
  );
};

const chooseOpponentIndex = (
  entries: PairingEntry[],
  firstIndex: number,
  currentRound: number,
  lastRoundByTeam: Map<number, number>,
  pairCounts: Map<string, number>,
  sideCounts: Map<number, SideCounter>,
  random: () => number
): number => {
  const first = entries[firstIndex];
  let bestIndex = -1;
  let bestCost = Number.POSITIVE_INFINITY;

  for (let index = 0; index < entries.length; index += 1) {
    const candidate = entries[index];
    if (index === firstIndex || candidate.teamNumber === first.teamNumber) {
      continue;
    }

    const cost = calculateOpponentCost({
      candidate,
      currentRound,
      first,
      lastRoundByTeam,
      pairCounts,
      random,
      sideCounts,
    });
    if (cost < bestCost) {
      bestCost = cost;
      bestIndex = index;
    }
  }

  if (bestIndex >= 0) {
    return bestIndex;
  }

  return firstIndex === 0 ? 1 : 0;
};

export const buildQualificationLineups = (
  teamNumbers: number[],
  startTime: number,
  cycleTimeSeconds: number,
  fieldStartOffsetSeconds: number,
  fieldCount: number,
  matchesPerTeam: number
): OneVsOneScheduleMatch[] => {
  const entries = teamNumbers.flatMap((teamNumber) =>
    Array.from({ length: matchesPerTeam }, () => ({
      teamNumber,
      isSurrogate: false,
    }))
  );
  if (entries.length % 2 !== 0) {
    entries.push({ teamNumber: teamNumbers[0], isSurrogate: true });
  }

  const random = createSeededRandom(Date.now());
  const remainingEntries = [...entries];
  const pairCounts = new Map<string, number>();
  const sideCounts = new Map<number, SideCounter>();
  const lastRoundByTeam = new Map<number, number>();
  const matches: OneVsOneScheduleMatch[] = [];
  const effectiveFieldCount = Math.max(1, fieldCount);

  for (let matchNumber = 1; remainingEntries.length >= 2; matchNumber += 1) {
    const currentRound = Math.floor((matchNumber - 1) / effectiveFieldCount);
    const firstIndex = chooseEntryIndex(
      remainingEntries,
      random,
      currentRound,
      lastRoundByTeam
    );
    const opponentIndex = chooseOpponentIndex(
      remainingEntries,
      firstIndex,
      currentRound,
      lastRoundByTeam,
      pairCounts,
      sideCounts,
      random
    );
    const first = remainingEntries[firstIndex];
    const second = remainingEntries[opponentIndex];
    const assignment = chooseSideAssignment(first, second, sideCounts, random);
    const matchTimes = computeMatchTimes(
      matchNumber - 1,
      startTime,
      cycleTimeSeconds,
      { fieldCount, fieldStartOffsetSeconds }
    );

    matches.push({
      matchNumber,
      redTeam: assignment.red.teamNumber,
      redSurrogate: assignment.red.isSurrogate,
      blueTeam: assignment.blue.teamNumber,
      blueSurrogate: assignment.blue.isSurrogate,
      startTime: matchTimes.startTime,
      endTime: matchTimes.endTime,
    });

    const pairKey = createPairKey(
      assignment.red.teamNumber,
      assignment.blue.teamNumber
    );
    pairCounts.set(pairKey, (pairCounts.get(pairKey) ?? 0) + 1);
    sideCounts.set(assignment.red.teamNumber, {
      ...getSideCounter(sideCounts, assignment.red.teamNumber),
      red: getSideCounter(sideCounts, assignment.red.teamNumber).red + 1,
    });
    sideCounts.set(assignment.blue.teamNumber, {
      ...getSideCounter(sideCounts, assignment.blue.teamNumber),
      blue: getSideCounter(sideCounts, assignment.blue.teamNumber).blue + 1,
    });
    lastRoundByTeam.set(assignment.red.teamNumber, currentRound);
    lastRoundByTeam.set(assignment.blue.teamNumber, currentRound);

    for (const index of [firstIndex, opponentIndex].sort((a, b) => b - a)) {
      remainingEntries.splice(index, 1);
    }
  }

  return matches;
};

export const computeQualificationMetrics = (
  matches: OneVsOneScheduleMatch[]
): QualificationMetrics => {
  const pairCounts = new Map<string, number>();
  const sideCounts = new Map<number, SideCounter>();
  const matchesByTeam = new Map<number, number[]>();
  let surrogateSlots = 0;

  for (const match of matches) {
    const pairKey = createPairKey(match.redTeam, match.blueTeam);
    pairCounts.set(pairKey, (pairCounts.get(pairKey) ?? 0) + 1);
    sideCounts.set(match.redTeam, {
      ...getSideCounter(sideCounts, match.redTeam),
      red: getSideCounter(sideCounts, match.redTeam).red + 1,
    });
    sideCounts.set(match.blueTeam, {
      ...getSideCounter(sideCounts, match.blueTeam),
      blue: getSideCounter(sideCounts, match.blueTeam).blue + 1,
    });
    matchesByTeam.set(match.redTeam, [
      ...(matchesByTeam.get(match.redTeam) ?? []),
      match.matchNumber,
    ]);
    matchesByTeam.set(match.blueTeam, [
      ...(matchesByTeam.get(match.blueTeam) ?? []),
      match.matchNumber,
    ]);
    surrogateSlots += Number(match.redSurrogate) + Number(match.blueSurrogate);
  }

  const repeatCounts = [...pairCounts.values()].filter((count) => count > 1);
  let maxSideImbalance = 0;
  let sideImbalanceTotal = 0;
  for (const counter of sideCounts.values()) {
    const imbalance = Math.abs(counter.red - counter.blue);
    maxSideImbalance = Math.max(maxSideImbalance, imbalance);
    sideImbalanceTotal += imbalance;
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
    repeatOpponentPairs: repeatCounts.reduce(
      (total, count) => total + (count - 1),
      0
    ),
    maxOpponentRepeat: repeatCounts.length > 0 ? Math.max(...repeatCounts) : 1,
    maxSideImbalance,
    averageSideImbalance:
      sideCounts.size === 0 ? 0 : sideImbalanceTotal / sideCounts.size,
    backToBackCount,
    surrogateSlots,
  };
};
