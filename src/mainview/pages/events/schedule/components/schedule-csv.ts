import type { ScheduleMatchRow } from "./schedule-match-table";
import { formatDisplayTime } from "./schedule-utils";

export interface OneVsOneCsvMatch {
  blueSurrogate: boolean;
  blueTeam: number;
  matchNumber: number;
  redSurrogate: boolean;
  redTeam: number;
}

const LEGACY_SURROGATE_VALUES = new Set(["", "0", "1", "false", "true"]);
const INTEGER_VALUE_PATTERN = /^\d+$/;

const isStrictIntegerValue = (value: string): boolean =>
  INTEGER_VALUE_PATTERN.test(value);

const parseLegacySurrogateValue = (value: string | undefined): boolean =>
  value === "1" || value?.toLowerCase() === "true";

const parseMatchNumberFromDisplayValue = (
  value: string,
  lineIndex: number
): number => {
  const numberMatches = value.match(/\d+/g);
  if (!numberMatches || numberMatches.length === 0) {
    throw new Error(
      `Line ${lineIndex + 1}: match column must include a match number.`
    );
  }

  const matchNumberText = numberMatches.at(-1);
  if (!matchNumberText) {
    throw new Error(
      `Line ${lineIndex + 1}: match column must include a match number.`
    );
  }

  const matchNumber = Number.parseInt(matchNumberText, 10);
  if (!Number.isInteger(matchNumber) || matchNumber <= 0) {
    throw new Error(`Line ${lineIndex + 1}: match number must be > 0.`);
  }
  return matchNumber;
};

const parseDisplayTeamCell = (
  value: string,
  lineIndex: number,
  side: "red" | "blue"
): { surrogate: boolean; teamNumber: number } => {
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) {
    throw new Error(`Line ${lineIndex + 1}: ${side} team is required.`);
  }

  const surrogate = trimmedValue.endsWith("*");
  const numericPortion = surrogate
    ? trimmedValue.slice(0, -1).trim()
    : trimmedValue;

  if (!isStrictIntegerValue(numericPortion)) {
    throw new Error(
      `Line ${lineIndex + 1}: ${side} team must be a number with optional trailing "*".`
    );
  }

  const teamNumber = Number.parseInt(numericPortion, 10);
  if (!Number.isInteger(teamNumber) || teamNumber <= 0) {
    throw new Error(`Line ${lineIndex + 1}: ${side} team must be > 0.`);
  }

  return { surrogate, teamNumber };
};

const isLegacyCsvLine = (parts: string[]): boolean => {
  if (parts.length < 3 || parts.length > 5) {
    return false;
  }

  if (
    !(
      isStrictIntegerValue(parts[0]) &&
      isStrictIntegerValue(parts[1]) &&
      isStrictIntegerValue(parts[2])
    )
  ) {
    return false;
  }

  if (parts.length === 3) {
    return true;
  }

  if (parts.length === 4) {
    return LEGACY_SURROGATE_VALUES.has(parts[3].toLowerCase());
  }

  return (
    LEGACY_SURROGATE_VALUES.has(parts[3].toLowerCase()) &&
    LEGACY_SURROGATE_VALUES.has(parts[4].toLowerCase())
  );
};

const parseLegacyMatchLine = (
  parts: string[],
  lineIndex: number,
  seenMatchNumbers: Set<number>
): OneVsOneCsvMatch => {
  const matchNumber = Number.parseInt(parts[0], 10);
  const redTeam = Number.parseInt(parts[1], 10);
  const blueTeam = Number.parseInt(parts[2], 10);
  const redSurrogate = parseLegacySurrogateValue(parts[3]);
  const blueSurrogate = parseLegacySurrogateValue(parts[4]);

  if (!Number.isInteger(matchNumber) || matchNumber <= 0) {
    throw new Error(`Line ${lineIndex + 1}: match number must be > 0.`);
  }
  if (!Number.isInteger(redTeam) || redTeam <= 0) {
    throw new Error(`Line ${lineIndex + 1}: red team must be > 0.`);
  }
  if (!Number.isInteger(blueTeam) || blueTeam <= 0) {
    throw new Error(`Line ${lineIndex + 1}: blue team must be > 0.`);
  }
  if (redTeam === blueTeam) {
    throw new Error(`Line ${lineIndex + 1}: red and blue cannot match.`);
  }
  if (seenMatchNumbers.has(matchNumber)) {
    throw new Error(`Line ${lineIndex + 1}: duplicate match number.`);
  }

  seenMatchNumbers.add(matchNumber);
  return { matchNumber, redTeam, blueTeam, redSurrogate, blueSurrogate };
};

const parseDisplayMatchLine = (
  parts: string[],
  lineIndex: number,
  seenMatchNumbers: Set<number>
): OneVsOneCsvMatch => {
  const matchNumber = parseMatchNumberFromDisplayValue(parts[1], lineIndex);

  if (!isStrictIntegerValue(parts[2]) || Number.parseInt(parts[2], 10) <= 0) {
    throw new Error(`Line ${lineIndex + 1}: field must be > 0.`);
  }

  const redTeamCell = parseDisplayTeamCell(parts[3], lineIndex, "red");
  const blueTeamCell = parseDisplayTeamCell(parts[4], lineIndex, "blue");

  if (redTeamCell.teamNumber === blueTeamCell.teamNumber) {
    throw new Error(`Line ${lineIndex + 1}: red and blue cannot match.`);
  }
  if (seenMatchNumbers.has(matchNumber)) {
    throw new Error(`Line ${lineIndex + 1}: duplicate match number.`);
  }

  seenMatchNumbers.add(matchNumber);
  return {
    matchNumber,
    redTeam: redTeamCell.teamNumber,
    redSurrogate: redTeamCell.surrogate,
    blueTeam: blueTeamCell.teamNumber,
    blueSurrogate: blueTeamCell.surrogate,
  };
};

const parseMatchCsvLine = (
  line: string,
  lineIndex: number,
  seenMatchNumbers: Set<number>
): OneVsOneCsvMatch | null => {
  const parts = line.split(",").map((part) => part.trim());
  const firstValue = parts[0]?.toLowerCase();
  if (firstValue?.startsWith("match") || firstValue?.startsWith("start")) {
    return null;
  }

  if (isLegacyCsvLine(parts)) {
    return parseLegacyMatchLine(parts, lineIndex, seenMatchNumbers);
  }

  if (parts.length === 5) {
    return parseDisplayMatchLine(parts, lineIndex, seenMatchNumbers);
  }

  throw new Error(
    `Line ${lineIndex + 1}: expected format "start time,match,field,red,blue" or "match,red,blue[,reds,blues]".`
  );
};

export const parseMatchesFromCsvText = (value: string): OneVsOneCsvMatch[] => {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const matches: OneVsOneCsvMatch[] = [];
  const seenMatchNumbers = new Set<number>();

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const parsed = parseMatchCsvLine(
      lines[lineIndex],
      lineIndex,
      seenMatchNumbers
    );
    if (parsed) {
      matches.push(parsed);
    }
  }

  matches.sort((left, right) => left.matchNumber - right.matchNumber);
  return matches;
};

const formatDisplayTeamCell = (
  teamNumber: number,
  surrogate: boolean
): string => `${teamNumber}${surrogate ? "*" : ""}`;

export const formatMatchesToCsvText = (matches: ScheduleMatchRow[]): string =>
  matches
    .map((match) =>
      [
        formatDisplayTime(match.startTime),
        match.matchLabel,
        match.fieldNumber,
        formatDisplayTeamCell(match.redTeam, match.redSurrogate),
        formatDisplayTeamCell(match.blueTeam, match.blueSurrogate),
      ].join(",")
    )
    .join("\n");

export const buildMatchesCsvFileContent = (
  matches: ScheduleMatchRow[]
): string =>
  `Start Time,Match,Field,Red,Blue\n${formatMatchesToCsvText(matches)}`;
