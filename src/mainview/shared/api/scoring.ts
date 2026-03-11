import { requestJson } from "@/shared/api/http-client";
import type {
  MatchHistoryEventItem,
  MatchHistoryItem,
  MatchResultItem,
  MatchScoresheet,
  MatchType,
} from "@/shared/types/scoring";

/** Shape matching ScoringEntryForm ScoringState for mapping to API. */
export interface ScoringStateForApi {
  bulletsInEnemyZone: number;
  flagsCenterDefended: number;
  flagsCenterShot: number;
  flagsL1Defended: number;
  flagsL2Defended: number;
  flagsOtherShot: number;
  goldenFlagsBonus: number;
  robotParking: 0 | 1 | 2;
}

/** API body for saving an alliance score. MatchType is "quals" | "elims" (no practice). */
export interface SaveMatchAllianceScoreBody {
  aCenterFlags: number;
  aFirstTierFlags: number;
  alliance: "red" | "blue";
  aSecondTierFlags: number;
  bBaseFlagsDown: number;
  bCenterFlagDown: number;
  cOpponentBackfieldBullets: number;
  dGoldFlagsDefended: number;
  dRobotParkState: number;
  matchNumber: number;
  matchType: "quals" | "elims";
}

/** Map form ScoringState to API SaveMatchAllianceScoreBody fields. */
export const scoringStateToApiBody = (
  state: ScoringStateForApi,
  alliance: "red" | "blue",
  matchNumber: number,
  matchType: "quals" | "elims"
): SaveMatchAllianceScoreBody => ({
  alliance,
  matchNumber,
  matchType,
  aSecondTierFlags: state.flagsL2Defended,
  aFirstTierFlags: state.flagsL1Defended,
  aCenterFlags: state.flagsCenterDefended,
  bCenterFlagDown: Math.min(1, Math.max(0, state.flagsCenterShot)),
  bBaseFlagsDown: state.flagsOtherShot,
  cOpponentBackfieldBullets: state.bulletsInEnemyZone,
  dRobotParkState: state.robotParking,
  dGoldFlagsDefended: state.goldenFlagsBonus,
});

/** Map server MatchHistoryItem to ScoringStateForApi for pre-populating forms. */
export const scoresheetToScoringState = (
  item: MatchHistoryItem
): ScoringStateForApi => ({
  flagsL2Defended: item.aSecondTierFlags,
  flagsL1Defended: item.aFirstTierFlags,
  flagsCenterDefended: item.aCenterFlags,
  flagsCenterShot: item.bCenterFlagDown,
  flagsOtherShot: item.bBaseFlagsDown,
  bulletsInEnemyZone: item.cOpponentBackfieldBullets,
  robotParking: Math.min(2, Math.max(0, item.dRobotParkState)) as 0 | 1 | 2,
  goldenFlagsBonus: item.dGoldFlagsDefended,
});

export const saveMatchAllianceScore = (
  eventCode: string,
  body: SaveMatchAllianceScoreBody,
  token: string
): Promise<unknown> =>
  requestJson<unknown>(
    `/events/${encodeURIComponent(eventCode)}/scoring/matches`,
    {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "PUT",
      token,
    }
  );

export const fetchMatchResults = (
  eventCode: string,
  matchType: MatchType,
  token: string | null
): Promise<MatchResultItem[]> =>
  requestJson<MatchResultItem[]>(
    `/events/${encodeURIComponent(eventCode)}/scoring/${matchType}/results`,
    {
      method: "GET",
      token,
    }
  );

export const fetchMatchHistory = (
  eventCode: string,
  matchType: MatchType,
  matchNumber: number,
  token: string | null
): Promise<MatchHistoryEventItem[]> =>
  requestJson<MatchHistoryEventItem[]>(
    `/events/${encodeURIComponent(eventCode)}/scoring/${matchType}/${matchNumber}/history`,
    {
      method: "GET",
      token,
    }
  );

export const fetchMatchScoresheet = (
  eventCode: string,
  matchType: MatchType,
  matchNumber: number,
  token: string | null
): Promise<MatchScoresheet> =>
  requestJson<MatchScoresheet>(
    `/events/${encodeURIComponent(eventCode)}/scoring/${matchType}/${matchNumber}`,
    {
      method: "GET",
      token,
    }
  );
