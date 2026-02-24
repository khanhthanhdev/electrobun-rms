import {
  type AddEventTeamInput,
  addEventTeam,
  listEventTeams,
} from "../server/services/event-teams-service";
import { ServiceError } from "../server/services/manual-event-service";

const EVENT_CODE = "nrc1";

// Edit this list when you want different teams for the nrc1 event seed.
const TEAMS_TO_SEED: AddEventTeamInput[] = [
  {
    teamNumber: 2001,
    teamName: "NRC1 Team 01",
    organizationSchool: "Regional School 01",
    city: "Ho Chi Minh",
    country: "Vietnam",
  },
  {
    teamNumber: 2002,
    teamName: "NRC1 Team 02",
    organizationSchool: "Regional School 02",
    city: "Ho Chi Minh",
    country: "Vietnam",
  },
  {
    teamNumber: 2003,
    teamName: "NRC1 Team 03",
    organizationSchool: "Regional School 03",
    city: "Ho Chi Minh",
    country: "Vietnam",
  },
  {
    teamNumber: 2004,
    teamName: "NRC1 Team 04",
    organizationSchool: "Regional School 04",
    city: "Ho Chi Minh",
    country: "Vietnam",
  },
  {
    teamNumber: 2005,
    teamName: "NRC1 Team 05",
    organizationSchool: "Regional School 05",
    city: "Ho Chi Minh",
    country: "Vietnam",
  },
  {
    teamNumber: 2006,
    teamName: "NRC1 Team 06",
    organizationSchool: "Regional School 06",
    city: "Ho Chi Minh",
    country: "Vietnam",
  },
  {
    teamNumber: 2007,
    teamName: "NRC1 Team 07",
    organizationSchool: "Regional School 07",
    city: "Ho Chi Minh",
    country: "Vietnam",
  },
  {
    teamNumber: 2008,
    teamName: "NRC1 Team 08",
    organizationSchool: "Regional School 08",
    city: "Ho Chi Minh",
    country: "Vietnam",
  },
  {
    teamNumber: 2009,
    teamName: "NRC1 Team 09",
    organizationSchool: "Regional School 09",
    city: "Ho Chi Minh",
    country: "Vietnam",
  },
  {
    teamNumber: 2010,
    teamName: "NRC1 Team 10",
    organizationSchool: "Regional School 10",
    city: "Ho Chi Minh",
    country: "Vietnam",
  },
  {
    teamNumber: 2011,
    teamName: "NRC1 Team 11",
    organizationSchool: "Regional School 11",
    city: "Ho Chi Minh",
    country: "Vietnam",
  },
  {
    teamNumber: 2012,
    teamName: "NRC1 Team 12",
    organizationSchool: "Regional School 12",
    city: "Ho Chi Minh",
    country: "Vietnam",
  },
  {
    teamNumber: 2013,
    teamName: "NRC1 Team 13",
    organizationSchool: "Regional School 13",
    city: "Ho Chi Minh",
    country: "Vietnam",
  },
  {
    teamNumber: 2014,
    teamName: "NRC1 Team 14",
    organizationSchool: "Regional School 14",
    city: "Ho Chi Minh",
    country: "Vietnam",
  },
  {
    teamNumber: 2015,
    teamName: "NRC1 Team 15",
    organizationSchool: "Regional School 15",
    city: "Ho Chi Minh",
    country: "Vietnam",
  },
  {
    teamNumber: 2016,
    teamName: "NRC1 Team 16",
    organizationSchool: "Regional School 16",
    city: "Ho Chi Minh",
    country: "Vietnam",
  },
  {
    teamNumber: 2017,
    teamName: "NRC1 Team 17",
    organizationSchool: "Regional School 17",
    city: "Da Nang",
    country: "Vietnam",
  },
  {
    teamNumber: 2018,
    teamName: "NRC1 Team 18",
    organizationSchool: "Regional School 18",
    city: "Da Nang",
    country: "Vietnam",
  },
  {
    teamNumber: 2019,
    teamName: "NRC1 Team 19",
    organizationSchool: "Regional School 19",
    city: "Da Nang",
    country: "Vietnam",
  },
  {
    teamNumber: 2020,
    teamName: "NRC1 Team 20",
    organizationSchool: "Regional School 20",
    city: "Da Nang",
    country: "Vietnam",
  },
  {
    teamNumber: 2021,
    teamName: "NRC1 Team 21",
    organizationSchool: "Regional School 21",
    city: "Da Nang",
    country: "Vietnam",
  },
  {
    teamNumber: 2022,
    teamName: "NRC1 Team 22",
    organizationSchool: "Regional School 22",
    city: "Da Nang",
    country: "Vietnam",
  },
  {
    teamNumber: 2023,
    teamName: "NRC1 Team 23",
    organizationSchool: "Regional School 23",
    city: "Da Nang",
    country: "Vietnam",
  },
  {
    teamNumber: 2024,
    teamName: "NRC1 Team 24",
    organizationSchool: "Regional School 24",
    city: "Da Nang",
    country: "Vietnam",
  },
  {
    teamNumber: 2025,
    teamName: "NRC1 Team 25",
    organizationSchool: "Regional School 25",
    city: "Can Tho",
    country: "Vietnam",
  },
  {
    teamNumber: 2026,
    teamName: "NRC1 Team 26",
    organizationSchool: "Regional School 26",
    city: "Can Tho",
    country: "Vietnam",
  },
  {
    teamNumber: 2027,
    teamName: "NRC1 Team 27",
    organizationSchool: "Regional School 27",
    city: "Can Tho",
    country: "Vietnam",
  },
  {
    teamNumber: 2028,
    teamName: "NRC1 Team 28",
    organizationSchool: "Regional School 28",
    city: "Can Tho",
    country: "Vietnam",
  },
  {
    teamNumber: 2029,
    teamName: "NRC1 Team 29",
    organizationSchool: "Regional School 29",
    city: "Can Tho",
    country: "Vietnam",
  },
  {
    teamNumber: 2030,
    teamName: "NRC1 Team 30",
    organizationSchool: "Regional School 30",
    city: "Can Tho",
    country: "Vietnam",
  },
  {
    teamNumber: 2031,
    teamName: "NRC1 Team 31",
    organizationSchool: "Regional School 31",
    city: "Can Tho",
    country: "Vietnam",
  },
  {
    teamNumber: 2032,
    teamName: "NRC1 Team 32",
    organizationSchool: "Regional School 32",
    city: "Can Tho",
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

const seedNRC1Teams = (): void => {
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
  seedNRC1Teams();
} catch (error) {
  if (error instanceof ServiceError) {
    console.error(`Seed failed: ${error.message}`);
    process.exit(1);
  }

  throw error;
}
