import {
  type AddEventTeamInput,
  addEventTeam,
  deleteEventTeam,
  type EventTeamItem,
  type EventTeamsResponse,
  listEventTeams,
  type UpdateEventTeamInput,
  updateEventTeam,
} from "../../services/event-teams-service";

export function listTeams(
  eventCode: string,
  search: string | undefined
): EventTeamsResponse {
  return listEventTeams(eventCode, search);
}

export function createTeam(
  eventCode: string,
  payload: AddEventTeamInput
): EventTeamItem {
  return addEventTeam(eventCode, payload);
}

export function editTeam(
  eventCode: string,
  teamNumber: number,
  payload: UpdateEventTeamInput
): EventTeamItem {
  return updateEventTeam(eventCode, teamNumber, payload);
}

export function removeTeam(eventCode: string, teamNumber: number): void {
  deleteEventTeam(eventCode, teamNumber);
}
