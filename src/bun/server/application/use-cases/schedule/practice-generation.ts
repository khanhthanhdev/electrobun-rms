import type {
  MatchBlockInput,
  OneVsOneScheduleMatch,
} from "../../dtos/schedule";
import { calculateRestPenalty, DEFAULT_MATCH_TIME_SECONDS } from "./shared";

interface PracticeBlockSchedulingOptions {
  fieldCount: number;
  fieldStartOffsetSeconds: number;
}

const createSeededRandom = (seed: number): (() => number) => {
  const modulus = 2_147_483_647;
  const multiplier = 48_271;
  let randomState = Math.abs(Math.trunc(seed)) % modulus || 1;

  return () => {
    randomState = (randomState * multiplier) % modulus;
    return randomState / modulus;
  };
};

const padPoolWithSurrogateIfNeeded = (
  pool: number[],
  teamCount: number,
  matchesPerTeam: number
): void => {
  if ((teamCount * matchesPerTeam) % 2 !== 0) {
    pool.push(0);
  }
};

export const buildPracticeBlockMatchStartTimes = (
  block: MatchBlockInput,
  options: PracticeBlockSchedulingOptions
): number[] => {
  const durationMs = block.endTime - block.startTime;
  if (durationMs <= 0 || block.cycleTimeSeconds <= 0) {
    return [];
  }

  const cycleTimeMs = block.cycleTimeSeconds * 1000;
  const fieldStartOffsetMs =
    Math.max(0, options.fieldStartOffsetSeconds) * 1000;
  const startTimes: number[] = [];

  for (
    let roundStartOffsetMs = 0;
    roundStartOffsetMs < durationMs;
    roundStartOffsetMs += cycleTimeMs
  ) {
    let hasStartInRound = false;
    for (
      let fieldIndex = 0;
      fieldIndex < Math.max(1, options.fieldCount);
      fieldIndex += 1
    ) {
      const matchStartOffsetMs =
        roundStartOffsetMs + fieldIndex * fieldStartOffsetMs;
      if (matchStartOffsetMs >= durationMs) {
        continue;
      }
      startTimes.push(block.startTime + matchStartOffsetMs);
      hasStartInRound = true;
    }
    if (!hasStartInRound) {
      break;
    }
  }

  return startTimes;
};

export const computeBlockCapacity = (
  block: MatchBlockInput,
  options: PracticeBlockSchedulingOptions
): number => buildPracticeBlockMatchStartTimes(block, options).length;

const scorePracticeSchedule = (
  schedule: [number, number][],
  fieldCount: number
): number => {
  const opponentCounts = new Map<string, number>();
  const lastRound = new Map<number, number>();
  let score = 0;

  for (let matchIndex = 0; matchIndex < schedule.length; matchIndex += 1) {
    const [teamA, teamB] = schedule[matchIndex];
    const currentRound = Math.floor(matchIndex / Math.max(1, fieldCount));
    const key = teamA < teamB ? `${teamA}:${teamB}` : `${teamB}:${teamA}`;
    const previousCount = opponentCounts.get(key) ?? 0;
    if (previousCount > 0) {
      score += previousCount * previousCount * 100;
    }
    opponentCounts.set(key, previousCount + 1);
    score += calculateRestPenalty(currentRound, lastRound, teamA);
    score += calculateRestPenalty(currentRound, lastRound, teamB);
    lastRound.set(teamA, currentRound);
    lastRound.set(teamB, currentRound);
  }

  return score;
};

const balanceSidesInSchedule = (schedule: [number, number][]): void => {
  const sideBalance = new Map<number, { blue: number; red: number }>();
  for (const teamIndex of schedule.flat()) {
    sideBalance.set(
      teamIndex,
      sideBalance.get(teamIndex) ?? { red: 0, blue: 0 }
    );
  }

  for (const pair of schedule) {
    const [a, b] = pair;
    const balanceA = sideBalance.get(a);
    const balanceB = sideBalance.get(b);
    if (!(balanceA && balanceB)) {
      continue;
    }

    const costAB =
      Math.abs(balanceA.red + 1 - balanceA.blue) +
      Math.abs(balanceB.blue + 1 - balanceB.red);
    const costBA =
      Math.abs(balanceB.red + 1 - balanceB.blue) +
      Math.abs(balanceA.blue + 1 - balanceA.red);

    if (costBA < costAB) {
      pair[0] = b;
      pair[1] = a;
      balanceB.red += 1;
      balanceA.blue += 1;
      continue;
    }

    balanceA.red += 1;
    balanceB.blue += 1;
  }
};

const buildPracticeLineups = (
  teamNumbers: number[],
  matchesPerTeam: number,
  fieldCount: number
): Array<{
  blueTeam: number;
  isBlueSurrogate: boolean;
  isRedSurrogate: boolean;
  redTeam: number;
}> => {
  const pool = teamNumbers.flatMap((_, teamIndex) =>
    Array.from({ length: matchesPerTeam }, () => teamIndex)
  );
  padPoolWithSurrogateIfNeeded(pool, teamNumbers.length, matchesPerTeam);

  const random = createSeededRandom(Date.now());
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }

  let currentSchedule: [number, number][] = [];
  for (let index = 0; index < pool.length - 1; index += 2) {
    currentSchedule.push([pool[index], pool[index + 1]]);
  }

  let currentScore = scorePracticeSchedule(currentSchedule, fieldCount);
  let bestSchedule = currentSchedule.map(
    (pair) => [...pair] as [number, number]
  );
  let bestScore = currentScore;
  let temperature = 100;
  const maxIterations = Math.min(
    Math.ceil((teamNumbers.length * matchesPerTeam) / 2) *
      teamNumbers.length *
      50,
    50_000
  );

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const candidate = currentSchedule.map(
      (pair) => [...pair] as [number, number]
    );
    const totalPositions = candidate.length * 2;
    const posA = Math.floor(random() * totalPositions);
    let posB = Math.floor(random() * (totalPositions - 1));
    if (posB >= posA) {
      posB += 1;
    }

    const matchA = Math.floor(posA / 2);
    const slotA = posA % 2;
    const matchB = Math.floor(posB / 2);
    const slotB = posB % 2;
    const teamAtA = candidate[matchA][slotA];
    const teamAtB = candidate[matchB][slotB];
    const partnerA = candidate[matchA][slotA === 0 ? 1 : 0];
    const partnerB = candidate[matchB][slotB === 0 ? 1 : 0];
    if (teamAtA === teamAtB || teamAtB === partnerA || teamAtA === partnerB) {
      continue;
    }

    candidate[matchA][slotA] = teamAtB;
    candidate[matchB][slotB] = teamAtA;
    const candidateScore = scorePracticeSchedule(candidate, fieldCount);
    const delta = candidateScore - currentScore;

    if (delta < 0 || random() < Math.exp(-delta / temperature)) {
      currentSchedule = candidate;
      currentScore = candidateScore;
      if (candidateScore < bestScore) {
        bestSchedule = candidate.map((pair) => [...pair] as [number, number]);
        bestScore = candidateScore;
      }
    }

    temperature *= 0.997;
    if (bestScore === 0) {
      break;
    }
  }

  balanceSidesInSchedule(bestSchedule);

  const appearances = new Map<number, number>();
  return bestSchedule.map(([redIndex, blueIndex]) => {
    const redCount = (appearances.get(redIndex) ?? 0) + 1;
    const blueCount = (appearances.get(blueIndex) ?? 0) + 1;
    appearances.set(redIndex, redCount);
    appearances.set(blueIndex, blueCount);

    return {
      redTeam: teamNumbers[redIndex],
      blueTeam: teamNumbers[blueIndex],
      isRedSurrogate: redCount > matchesPerTeam,
      isBlueSurrogate: blueCount > matchesPerTeam,
    };
  });
};

export const assignMatchesToBlocks = (
  lineups: Array<{
    blueTeam: number;
    isBlueSurrogate: boolean;
    isRedSurrogate: boolean;
    redTeam: number;
  }>,
  blocks: MatchBlockInput[],
  options: PracticeBlockSchedulingOptions
): OneVsOneScheduleMatch[] => {
  const matches: OneVsOneScheduleMatch[] = [];
  let lineupIndex = 0;

  for (const block of blocks) {
    for (const startTime of buildPracticeBlockMatchStartTimes(block, options)) {
      if (lineupIndex >= lineups.length) {
        return matches;
      }

      const lineup = lineups[lineupIndex];
      matches.push({
        matchNumber: lineupIndex + 1,
        redTeam: lineup.redTeam,
        redSurrogate: lineup.isRedSurrogate,
        blueTeam: lineup.blueTeam,
        blueSurrogate: lineup.isBlueSurrogate,
        startTime,
        endTime: startTime + DEFAULT_MATCH_TIME_SECONDS * 1000,
      });
      lineupIndex += 1;
    }
  }

  return matches;
};

export const buildPracticeScheduleMatches = (options: {
  blocks: MatchBlockInput[];
  fieldCount: number;
  fieldStartOffsetSeconds: number;
  matchesPerTeam: number;
  teamNumbers: number[];
}): OneVsOneScheduleMatch[] =>
  assignMatchesToBlocks(
    buildPracticeLineups(
      options.teamNumbers,
      options.matchesPerTeam,
      options.fieldCount
    ),
    options.blocks,
    {
      fieldCount: options.fieldCount,
      fieldStartOffsetSeconds: options.fieldStartOffsetSeconds,
    }
  );
