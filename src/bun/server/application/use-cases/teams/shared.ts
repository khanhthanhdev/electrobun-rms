import { ApplicationError } from "../../common/application-error";
import type { TeamItem } from "../../dtos/teams";

export const normalizeTeamsEventCode = (eventCode: string): string => {
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

export const normalizeTeamSearch = (search: string | undefined): string =>
  search?.trim().toLowerCase() ?? "";

export const buildSearchableTeamText = (team: TeamItem): string =>
  [
    team.teamNumber,
    team.teamName,
    team.organizationSchool,
    team.city,
    team.country,
  ]
    .join(" ")
    .toLowerCase();
