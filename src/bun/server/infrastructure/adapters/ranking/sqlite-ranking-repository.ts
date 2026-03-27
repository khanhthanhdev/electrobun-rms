import type {
  PersistedTeamRankingSnapshot,
  PostedQualificationMatch,
  QualificationRankingItem,
  QualificationRankingSourceFingerprintInput,
  RankingTeam,
  TeamRankingRowToPersist,
} from "../../../application/dtos/ranking";
import type { RankingRepository } from "../../../application/interfaces/ranking-repository";
import {
  loadPostedQualificationMatchesFromEventDb,
  loadQualificationRankingSourceFingerprintFromEventDb,
  loadRankingTeamsFromEventDb,
  loadStoredQualificationRankingSnapshotsFromEventDb,
  loadStoredQualificationRankingsFromEventDb,
} from "./sqlite-ranking-loaders";
import { replaceStoredQualificationRankingsInEventDb } from "./sqlite-ranking-persistence";
import { assertEventExists, withEventDb } from "./sqlite-ranking-shared";

export class SQLiteRankingRepository implements RankingRepository {
  loadPostedQualificationMatches(
    eventCode: string
  ): Promise<PostedQualificationMatch[]> {
    return Promise.resolve().then(() => {
      assertEventExists(eventCode);
      return withEventDb(eventCode, loadPostedQualificationMatchesFromEventDb);
    });
  }

  loadQualificationRankingSourceFingerprint(
    eventCode: string
  ): Promise<QualificationRankingSourceFingerprintInput> {
    return Promise.resolve().then(() => {
      assertEventExists(eventCode);
      return withEventDb(
        eventCode,
        loadQualificationRankingSourceFingerprintFromEventDb
      );
    });
  }

  loadRankingTeams(eventCode: string): Promise<RankingTeam[]> {
    return Promise.resolve().then(() => {
      assertEventExists(eventCode);
      return withEventDb(eventCode, loadRankingTeamsFromEventDb);
    });
  }

  loadStoredQualificationRankings(
    eventCode: string
  ): Promise<QualificationRankingItem[]> {
    return Promise.resolve().then(() => {
      assertEventExists(eventCode);
      return withEventDb(eventCode, loadStoredQualificationRankingsFromEventDb);
    });
  }

  loadStoredQualificationRankingSnapshots(
    eventCode: string
  ): Promise<PersistedTeamRankingSnapshot[]> {
    return Promise.resolve().then(() => {
      assertEventExists(eventCode);
      return withEventDb(
        eventCode,
        loadStoredQualificationRankingSnapshotsFromEventDb
      );
    });
  }

  replaceStoredQualificationRankings(
    eventCode: string,
    rows: TeamRankingRowToPersist[]
  ): Promise<void> {
    return Promise.resolve().then(() => {
      assertEventExists(eventCode);
      withEventDb(eventCode, (eventDb) =>
        replaceStoredQualificationRankingsInEventDb(eventDb, rows)
      );
    });
  }
}
