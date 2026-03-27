import type {
  InspectionChecklistItem,
  InspectionChecklistSection,
  InspectionStatus,
} from "./inspection-types";

export interface InspectionChecklistResponse {
  items: InspectionChecklistItem[];
  sections: InspectionChecklistSection[];
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
  teamName: string;
  teamNumber: number;
  updatedAt: string | null;
}

export interface InspectionTeamsResponse {
  eventCode: string;
  statusCounts: Record<InspectionStatus, number>;
  teams: InspectionTeamSummary[];
  totalTeams: number;
}

export interface InspectionTeamDetail {
  teamName: string | null;
  teamNumber: number;
}

export interface InspectionRecord {
  comment: string | null;
  finalizedAt: string | null;
  id: string;
  startedAt: string | null;
  status: InspectionStatus;
  statusCode: string;
  statusLabel: string;
  updatedAt: string | null;
}

export interface InspectionDetailResponse {
  checklist: {
    items: InspectionChecklistItem[];
    sections: InspectionChecklistSection[];
  };
  inspection: InspectionRecord;
  progress: InspectionProgress;
  responses: Record<string, string | null>;
  team: InspectionTeamDetail;
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

export interface PublicInspectionTeamStatus {
  status: InspectionStatus;
  statusCode: string;
  statusLabel: string;
  teamName: string;
  teamNumber: number;
}

export interface PublicInspectionStatusResponse {
  eventCode: string;
  statusCounts: Record<InspectionStatus, number>;
  teams: PublicInspectionTeamStatus[];
}
