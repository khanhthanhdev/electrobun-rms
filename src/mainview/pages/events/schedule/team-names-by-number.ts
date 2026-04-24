import type { EventTeamItem } from "@/features/events/teams";

export type TeamNamesByNumber = Record<number, string>;

export const buildTeamNamesByNumber = (
  teams: EventTeamItem[]
): TeamNamesByNumber => {
  const namesByNumber: TeamNamesByNumber = {};

  for (const team of teams) {
    const trimmedName = team.teamName.trim();
    if (!trimmedName) {
      continue;
    }

    namesByNumber[team.teamNumber] = trimmedName;
  }

  return namesByNumber;
};
