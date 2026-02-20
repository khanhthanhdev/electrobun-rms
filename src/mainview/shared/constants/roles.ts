export const ROLE_VALUES = [
  "ADMIN",
  "TSO",
  "HEAD_REFEREE",
  "REFEREE",
  "INSPECTOR",
  "LEAD_INSPECTOR",
  "JUDGE",
] as const;

export type RoleValue = (typeof ROLE_VALUES)[number];

export interface RoleColumn {
  label: string;
  value: RoleValue;
}

export const CREATE_ACCOUNT_ROLE_COLUMNS: RoleColumn[] = [
  { value: "ADMIN", label: "Event Admin" },
  { value: "TSO", label: "Field Manage" },
  { value: "REFEREE", label: "Referee" },
  { value: "JUDGE", label: "Judge" },
  { value: "INSPECTOR", label: "Inspector" },
  { value: "LEAD_INSPECTOR", label: "Lead Inspector" },
  { value: "HEAD_REFEREE", label: "Head Referee" },
];
