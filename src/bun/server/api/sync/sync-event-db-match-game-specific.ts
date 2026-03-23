import type { Database } from "bun:sqlite";
import { resolveMatchStorage } from "./sync-event-db-match-persistence";
import { ensureGameSpecificTables } from "./sync-event-db-match-tables";
import { parsePositiveInteger, tableExists } from "./sync-event-db-shared";
import type { MatchType } from "./sync-event-db-types";

type MatchAllianceDetails = Record<string, unknown>;
type MatchDetails = {
  blueAlliance?: MatchAllianceDetails;
  redAlliance?: MatchAllianceDetails;
} | null;

const insertAllianceDetails = (
  eventDb: Database,
  tableName:
    | "elims_game_specific"
    | "practice_game_specific"
    | "quals_game_specific",
  historyTable:
    | "elims_game_specific_history"
    | "practice_game_specific_history"
    | "quals_game_specific_history",
  matchNumber: number,
  playedAt: number,
  alliance: { details: MatchAllianceDetails; value: 0 | 1 }
): void => {
  const row = alliance.details;

  eventDb
    .query(`DELETE FROM ${tableName} WHERE match = ? AND alliance = ?`)
    .run(matchNumber, alliance.value);
  eventDb
    .query(
      `INSERT INTO ${tableName} (
        match,
        alliance,
        a_second_tier_flags,
        a_first_tier_flags,
        a_center_flags,
        b_center_flag_down,
        b_base_flags_down,
        c_opponent_backfield_bullets,
        d_robot_park_state,
        d_gold_flags_defended,
        score_a,
        score_b,
        score_c,
        score_d,
        score_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      matchNumber,
      alliance.value,
      parsePositiveInteger(row.aSecondTierFlags, 0),
      parsePositiveInteger(row.aFirstTierFlags, 0),
      parsePositiveInteger(row.aCenterFlags, 0),
      parsePositiveInteger(row.bCenterFlagDown, 0),
      parsePositiveInteger(row.bBaseFlagsDown, 0),
      parsePositiveInteger(row.cOpponentBackfieldBullets, 0),
      parsePositiveInteger(row.dRobotParkState, 0),
      parsePositiveInteger(row.dGoldFlagsDefended, 0),
      parsePositiveInteger(row.scoreA, 0),
      parsePositiveInteger(row.scoreB, 0),
      parsePositiveInteger(row.scoreC, 0),
      parsePositiveInteger(row.scoreD, 0),
      parsePositiveInteger(row.scoreTotal, 0)
    );
  eventDb
    .query(
      `INSERT INTO ${historyTable} (
        match,
        ts,
        alliance,
        a_second_tier_flags,
        a_first_tier_flags,
        a_center_flags,
        b_center_flag_down,
        b_base_flags_down,
        c_opponent_backfield_bullets,
        d_robot_park_state,
        d_gold_flags_defended,
        score_a,
        score_b,
        score_c,
        score_d,
        score_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      matchNumber,
      playedAt,
      alliance.value,
      parsePositiveInteger(row.aSecondTierFlags, 0),
      parsePositiveInteger(row.aFirstTierFlags, 0),
      parsePositiveInteger(row.aCenterFlags, 0),
      parsePositiveInteger(row.bCenterFlagDown, 0),
      parsePositiveInteger(row.bBaseFlagsDown, 0),
      parsePositiveInteger(row.cOpponentBackfieldBullets, 0),
      parsePositiveInteger(row.dRobotParkState, 0),
      parsePositiveInteger(row.dGoldFlagsDefended, 0),
      parsePositiveInteger(row.scoreA, 0),
      parsePositiveInteger(row.scoreB, 0),
      parsePositiveInteger(row.scoreC, 0),
      parsePositiveInteger(row.scoreD, 0),
      parsePositiveInteger(row.scoreTotal, 0)
    );
};

export const syncMatchGameSpecificDetails = (
  eventDb: Database,
  matchType: MatchType,
  matchNumber: number,
  playedAt: number,
  details: MatchDetails
): void => {
  const { gameSpecificTable, historyTable } = resolveMatchStorage(matchType);

  if (details?.redAlliance && details.blueAlliance) {
    ensureGameSpecificTables(eventDb, gameSpecificTable, historyTable);

    for (const alliance of [
      { value: 0 as const, details: details.redAlliance },
      { value: 1 as const, details: details.blueAlliance },
    ]) {
      insertAllianceDetails(
        eventDb,
        gameSpecificTable,
        historyTable,
        matchNumber,
        playedAt,
        alliance
      );
    }
    return;
  }

  if (tableExists(eventDb, gameSpecificTable)) {
    eventDb
      .query(`DELETE FROM ${gameSpecificTable} WHERE match = ?`)
      .run(matchNumber);
  }
};
