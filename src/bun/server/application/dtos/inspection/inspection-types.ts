export type InspectionStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "INCOMPLETE"
  | "PASSED";

export type InspectionInputType = "CHECKBOX" | "SELECT" | "NUMBER";

export interface InspectionItemUpdate {
  key: string;
  value: string | null;
}

export interface InspectionChecklistSection {
  id: string;
  key: string;
  label: string;
  order: number;
}

export interface InspectionChecklistOption {
  isSentinel?: boolean;
  key: string;
  label: string;
  order: number;
}

export interface InspectionChecklistItem {
  description?: string;
  inputType: InspectionInputType;
  key: string;
  label: string;
  options?: InspectionChecklistOption[];
  required: boolean;
  ruleCode: string;
  sectionId: string;
}
