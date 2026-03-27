export interface EventItem {
  code: string;
  divisions: number;
  end: number;
  fields: number;
  finals: number;
  name: string;
  region: string;
  start: number;
  status: number;
  type: number;
}

export interface EventsResponse {
  events: EventItem[];
}

export interface ManualEventInput {
  divisions: number;
  endDate: string;
  eventCode: string;
  eventName: string;
  eventType: number;
  fields?: number;
  finals?: number;
  region: string;
  startDate: string;
  status?: number;
}

export interface UpdateEventInput {
  divisions: number;
  endDate: string;
  eventName: string;
  eventType: number;
  fields?: number;
  finals?: number;
  region: string;
  startDate: string;
  status?: number;
}

export interface CreateManualEventResponse {
  event: EventItem;
}

export interface DefaultEventAccountItem {
  password: string;
  role: string;
  username: string;
}

export interface DefaultEventAccountsResponse {
  accounts: DefaultEventAccountItem[];
  eventCode: string;
}

export interface PrintableAccountItem {
  password: string | null;
  role: string;
  username: string;
}

export interface PrintableTeamItem {
  location: string;
  name: string;
  teamNumber: number;
}

export interface PrintableMatchItem {
  blueScore: number;
  fieldType: number;
  matchId: string;
  playNumber: number;
  redScore: number;
  startTime: string;
}

export interface PrintableScheduleItem {
  description: string;
  matchNumber: number | null;
  stage: string;
  startTime: string;
}

export interface EventPrintListsResponse {
  accounts: PrintableAccountItem[];
  eventCode: string;
  generatedAt: string;
  matches: PrintableMatchItem[];
  schedules: PrintableScheduleItem[];
  teams: PrintableTeamItem[];
}
