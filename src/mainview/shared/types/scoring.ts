export type ScoringRealtimeChangeKind = "SCORE_UPDATED" | "SNAPSHOT_HINT";

export interface ScoringRealtimeChangeEvent {
  changedAt: string;
  eventCode: string;
  kind: ScoringRealtimeChangeKind;
  matchNumber: number | null;
  matchType: string | null;
  version: number;
}
