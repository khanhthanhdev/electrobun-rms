export const EDIT_EVENT_PATTERN = /^\/event\/([^/]+)\/edit\/?$/;
export const EVENT_DASHBOARD_PATTERN = /^\/event\/([^/]+)\/dashboard\/?$/;
export const EVENT_CONTROL_PATTERN = /^\/event\/([^/]+)\/control\/?$/;
export const EVENT_REPORTS_PATTERN =
  /^\/event\/([^/]+)\/dashboard\/reports\/?$/;
export const EVENT_TEAMS_PATTERN = /^\/event\/([^/]+)\/dashboard\/teams\/?$/;
export const PRACTICE_SCHEDULE_PATTERN =
  /^\/event\/([^/]+)\/dashboard\/schedule\/practice\/?$/;
export const QUALIFICATION_SCHEDULE_PATTERN =
  /^\/event\/([^/]+)\/dashboard\/schedule\/quals\/?$/;
export const PUBLIC_PRACTICE_SCHEDULE_PATTERN =
  /^\/event\/([^/]+)\/practice\/?$/;
export const PUBLIC_QUALIFICATION_SCHEDULE_PATTERN =
  /^\/event\/([^/]+)\/qual\/?$/;
export const PUBLIC_QUALIFICATION_RANKINGS_PATTERN =
  /^\/event\/([^/]+)\/qualification\/rankings\/?$/;
export const DEFAULT_ACCOUNTS_PATTERN =
  /^\/event\/([^/]+)\/dashboard\/defaultaccounts\/?$/;
export const CREATE_EVENT_PATTERN = /^\/create\/event\/?$/;
export const CREATE_ACCOUNT_PATTERN = /^\/create\/account\/?$/;
export const EVENT_DETAIL_PATTERN = /^\/event\/([^/]+)\/?$/;
export const MANAGE_USERS_PATTERN =
  /^(?:\/(?:user|users)\/manage|\/manage\/users)\/?$/;
export const MANAGE_USER_DETAIL_PATTERN =
  /^(?:\/(?:user|users)\/manage\/([^/]+)|\/manage\/users\/([^/]+))\/?$/;
export const MANAGE_SERVER_PATTERN = /^\/manage\/server\/?$/;
export const INSPECTION_TEAMS_PATTERN = /^\/event\/([^/]+)\/inspection\/?$/;
export const INSPECTION_DETAIL_PATTERN =
  /^\/event\/([^/]+)\/inspection\/(\d+)\/?$/;
export const INSPECTION_NOTES_PATTERN =
  /^\/event\/([^/]+)\/inspection\/notes\/?$/;
export const INSPECTION_EVENT_OVERRIDE_PATTERN =
  /^\/event\/([^/]+)\/inspection\/override\/?$/;
export const REFEREE_RED_SCORING_PATTERN =
  /^\/event\/([^/]+)\/ref\/red\/scoring(?:\/([^/]+))?\/?$/;
export const REFEREE_BLUE_SCORING_PATTERN =
  /^\/event\/([^/]+)\/ref\/blue\/scoring(?:\/([^/]+))?\/?$/;
export const HEAD_REFEREE_PATTERN = /^\/event\/([^/]+)\/hr(?:\/([^/]+))?\/?$/;
export const REFEREE_RED_SCORE_ENTRY_PATTERN =
  /^\/event\/([^/]+)\/ref\/red\/scoring\/([^/]+)\/match\/(\d+)\/?$/;
export const REFEREE_BLUE_SCORE_ENTRY_PATTERN =
  /^\/event\/([^/]+)\/ref\/blue\/scoring\/([^/]+)\/match\/(\d+)\/?$/;
export const HEAD_REFEREE_MATCH_PATTERN =
  /^\/event\/([^/]+)\/hr\/([^/]+)\/match\/(\d+)\/?$/;
export const MATCH_RESULTS_PATTERN = /^\/event\/([^/]+)\/results\/?$/;
export const MATCH_HISTORY_PATTERN =
  /^\/event\/([^/]+)\/match\/([^/]+)\/history\/?$/;
export const MATCH_SCORESHEET_PATTERN = /^\/event\/([^/]+)\/match\/([^/]+)\/?$/;
export const MATCH_ALLIANCE_SCORESHEET_PATTERN =
  /^\/event\/([^/]+)\/match\/([^/]+)\/(red|blue)\/?$/;
