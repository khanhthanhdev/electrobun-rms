import type { TeamsResponse } from "../../dtos/teams";
import type { TeamRepository } from "../../interfaces/team-repository";
import {
  buildSearchableTeamText,
  normalizeTeamSearch,
  normalizeTeamsEventCode,
} from "./shared";

export interface ListTeamsQuery {
  eventCode: string;
  search?: string;
}

export class ListTeamsUseCase {
  constructor(private readonly teamRepository: TeamRepository) {}

  async execute(query: ListTeamsQuery): Promise<TeamsResponse> {
    const eventCode = normalizeTeamsEventCode(query.eventCode);
    const teams = await this.teamRepository.listTeams(eventCode);
    const normalizedSearch = normalizeTeamSearch(query.search);

    return {
      eventCode,
      teams:
        normalizedSearch.length === 0
          ? teams
          : teams.filter((team) =>
              buildSearchableTeamText(team).includes(normalizedSearch)
            ),
    };
  }
}
