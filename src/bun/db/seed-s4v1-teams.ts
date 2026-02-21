import {
  type AddEventTeamInput,
  addEventTeam,
  listEventTeams,
} from "../server/services/event-teams-service";
import { ServiceError } from "../server/services/manual-event-service";

const EVENT_CODE = "s4v1";

// Edit this list when you want different teams for the s4v1 event seed.
const TEAMS_TO_SEED: AddEventTeamInput[] = [
  {
    teamNumber: 1001,
    teamName: "S4V1 Team 01",
    organizationSchool: "Control School 01",
    city: "Hanoi",
    country: "Vietnam",
  },
  {
    teamNumber: 1002,
    teamName: "S4V1 Team 02",
    organizationSchool: "Control School 02",
    city: "Hanoi",
    country: "Vietnam",
  },
  {
    teamNumber: 1003,
    teamName: "S4V1 Team 03",
    organizationSchool: "Control School 03",
    city: "Hanoi",
    country: "Vietnam",
  },
  {
    teamNumber: 1004,
    teamName: "S4V1 Team 04",
    organizationSchool: "Control School 04",
    city: "Hanoi",
    country: "Vietnam",
  },
  {
    teamNumber: 1005,
    teamName: "S4V1 Team 05",
    organizationSchool: "Control School 05",
    city: "Hanoi",
    country: "Vietnam",
  },
  {
    teamNumber: 1006,
    teamName: "S4V1 Team 06",
    organizationSchool: "Control School 06",
    city: "Hanoi",
    country: "Vietnam",
  },
  {
    teamNumber: 1007,
    teamName: "S4V1 Team 07",
    organizationSchool: "Control School 07",
    city: "Hanoi",
    country: "Vietnam",
  },
  {
    teamNumber: 1008,
    teamName: "S4V1 Team 08",
    organizationSchool: "Control School 08",
    city: "Hanoi",
    country: "Vietnam",
  },
  {
    teamNumber: 1009,
    teamName: "S4V1 Team 09",
    organizationSchool: "Control School 09",
    city: "Hanoi",
    country: "Vietnam",
  },
  {
    teamNumber: 1010,
    teamName: "S4V1 Team 10",
    organizationSchool: "Control School 10",
    city: "Hanoi",
    country: "Vietnam",
  },
  {
    teamNumber: 1011,
    teamName: "S4V1 Team 11",
    organizationSchool: "Control School 11",
    city: "Hanoi",
    country: "Vietnam",
  },
  {
    teamNumber: 1012,
    teamName: "S4V1 Team 12",
    organizationSchool: "Control School 12",
    city: "Hanoi",
    country: "Vietnam",
  },
  {
    teamNumber: 1013,
    teamName: "S4V1 Team 13",
    organizationSchool: "Control School 13",
    city: "Hanoi",
    country: "Vietnam",
  },
  {
    teamNumber: 1014,
    teamName: "S4V1 Team 14",
    organizationSchool: "Control School 14",
    city: "Hanoi",
    country: "Vietnam",
  },
  {
    teamNumber: 1015,
    teamName: "S4V1 Team 15",
    organizationSchool: "Control School 15",
    city: "Hanoi",
    country: "Vietnam",
  },
  {
    teamNumber: 1016,
    teamName: "S4V1 Team 16",
    organizationSchool: "Control School 16",
    city: "Hanoi",
    country: "Vietnam",
  },
];

const assertUniqueTeamNumbers = (teams: readonly AddEventTeamInput[]): void => {
  const teamNumbers = new Set<number>();

  for (const team of teams) {
    if (teamNumbers.has(team.teamNumber)) {
      throw new Error(
        `Duplicate team number detected in seed data: ${team.teamNumber}`
      );
    }

    teamNumbers.add(team.teamNumber);
  }
};

const seedS4V1Teams = (): void => {
  assertUniqueTeamNumbers(TEAMS_TO_SEED);

  for (const team of TEAMS_TO_SEED) {
    addEventTeam(EVENT_CODE, team);
  }

  const seededTeamNumbers = new Set(
    TEAMS_TO_SEED.map((team) => team.teamNumber)
  );
  const allTeams = listEventTeams(EVENT_CODE, undefined).teams;
  const controlledTeams = allTeams.filter((team) =>
    seededTeamNumbers.has(team.teamNumber)
  );

  console.log(
    `Seed complete for event "${EVENT_CODE}": ${controlledTeams.length}/${TEAMS_TO_SEED.length} controlled teams present. Total teams in event: ${allTeams.length}.`
  );
};

try {
  seedS4V1Teams();
} catch (error) {
  if (error instanceof ServiceError) {
    console.error(`Seed failed: ${error.message}`);
    process.exit(1);
  }

  throw error;
}
