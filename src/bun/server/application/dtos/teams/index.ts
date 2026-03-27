export interface TeamItem {
  advancement: number;
  city: string;
  country: string;
  division: number;
  organizationSchool: string;
  teamName: string;
  teamNumber: number;
}

export interface TeamsResponse {
  eventCode: string;
  teams: TeamItem[];
}

export interface CreateTeamInput {
  city?: string;
  country?: string;
  organizationSchool?: string;
  teamName: string;
  teamNumber: number;
}

export interface SeedTeamInput extends CreateTeamInput {}

export interface UpdateTeamInput {
  city?: string;
  country?: string;
  organizationSchool?: string;
  teamName: string;
}

export interface DeleteTeamResponse {
  deletedTeamNumber: number;
}
