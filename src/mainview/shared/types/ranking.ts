export type QualificationRankingRealtimeChangeKind =
  | "RANKINGS_UPDATED"
  | "SNAPSHOT_HINT";

export interface QualificationRankingRealtimeChangeEvent {
  changedAt: string;
  eventCode: string;
  kind: QualificationRankingRealtimeChangeKind;
  version: number;
}
