export type InspectionStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "INCOMPLETE"
  | "PASSED";

export type InspectionInputType = "CHECKBOX" | "SELECT" | "NUMBER";

export interface ChecklistOption {
  isSentinel?: boolean;
  key: string;
  label: string;
  order: number;
}

export interface ChecklistItem {
  inputType: InspectionInputType;
  key: string;
  label: string;
  options?: ChecklistOption[];
  required: boolean;
  ruleCode: string;
  sectionId: string;
}

export interface ChecklistSection {
  id: string;
  key: string;
  label: string;
  order: number;
}

export interface ChecklistDefinition {
  items: ChecklistItem[];
  sections: ChecklistSection[];
}

export interface InspectionProgress {
  completedRequired: number;
  missingRequired: number;
  totalRequired: number;
}

export interface InspectionTeamSummary {
  comment: string | null;
  progress: InspectionProgress;
  status: InspectionStatus;
  statusCode: string;
  statusLabel: string;
  teamName: string | null;
  teamNumber: number;
  updatedAt: string | null;
}

export interface InspectionTeamsResponse {
  eventCode: string;
  statusCounts: Record<InspectionStatus, number>;
  teams: InspectionTeamSummary[];
  totalTeams: number;
}

export interface InspectionDetailResponse {
  checklist: ChecklistDefinition;
  inspection: {
    comment: string | null;
    finalizedAt: string | null;
    id: string;
    startedAt: string | null;
    status: InspectionStatus;
    statusCode: string;
    statusLabel: string;
    updatedAt: string | null;
  };
  progress: InspectionProgress;
  responses: Record<string, string | null>;
  team: {
    teamName: string | null;
    teamNumber: number;
  };
}

export interface InspectionPublicTeam {
  status: InspectionStatus;
  statusLabel: string;
  teamName: string | null;
  teamNumber: number;
}

export interface InspectionPublicStatusResponse {
  eventCode: string;
  statusCounts: Record<InspectionStatus, number>;
  teams: InspectionPublicTeam[];
  totalTeams: number;
}

export interface InspectionHistoryEntry {
  action: string;
  changedAt: string;
  changedBy: string;
  id: number;
  isOverride: boolean;
  newStatus: string | null;
  oldStatus: string | null;
}

export interface InspectionHistoryResponse {
  history: InspectionHistoryEntry[];
  teamNumber: number;
}
