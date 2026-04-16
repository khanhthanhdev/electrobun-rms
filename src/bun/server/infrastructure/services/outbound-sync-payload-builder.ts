import type { Database } from "bun:sqlite";
import {
  type MachinePushResourceType,
  type PushSyncBatchRequestDto,
  SYNC_DEFINITION_VERSION,
  SYNC_SCHEMA_VERSION,
} from "../../application/dtos/sync";
import {
  ListPracticeMatchesUseCase,
  ListQualificationMatchesUseCase,
} from "../../application/use-cases/schedule";
import {
  GetMatchResultsUseCase,
  GetMatchScoresheetUseCase,
} from "../../application/use-cases/scoring";
import { SQLiteScheduleRepository } from "../adapters/schedule/sqlite-schedule-repository";
import { SQLiteScoringRepository } from "../adapters/scoring";
import {
  parsePositiveInteger,
  parseTimestamp,
  tableExists,
  withEventDb,
} from "../adapters/sync/sync-event-db-shared";

const matchResultsUseCase = new GetMatchResultsUseCase(
  new SQLiteScoringRepository()
);
const matchScoresheetUseCase = new GetMatchScoresheetUseCase(
  new SQLiteScoringRepository()
);
const listPracticeMatchesUseCase = new ListPracticeMatchesUseCase(
  new SQLiteScheduleRepository()
);
const listQualificationMatchesUseCase = new ListQualificationMatchesUseCase(
  new SQLiteScheduleRepository()
);

const RESOURCE_MODE_BY_TYPE: Record<
  MachinePushResourceType,
  "replace_snapshot" | "upsert"
> = {
  inspection_results: "upsert",
  inspection_schedule: "replace_snapshot",
  match_results: "upsert",
  match_schedule: "replace_snapshot",
  team_awards: "replace_snapshot",
  team_rankings: "replace_snapshot",
};

const TEAM_NUMBER_PATTERN = /(\d+)$/;

const parseTeamNumberFromId = (fmsTeamId: unknown): string | undefined => {
  if (typeof fmsTeamId !== "string") {
    return undefined;
  }

  const match = fmsTeamId.match(TEAM_NUMBER_PATTERN);
  return match?.[1];
};

const toScoreDetails = (
  input: {
    aCenterFlags: number;
    aFirstTierFlags: number;
    aSecondTierFlags: number;
    bBaseFlagsDown: number;
    bCenterFlagDown: number;
    cOpponentBackfieldBullets: number;
    dGoldFlagsDefended: number;
    dRobotParkState: number;
    scoreA: number;
    scoreB: number;
    scoreC: number;
    scoreD: number;
    scoreTotal: number;
  } | null
) => ({
  aCenterFlags: input?.aCenterFlags ?? 0,
  aFirstTierFlags: input?.aFirstTierFlags ?? 0,
  aSecondTierFlags: input?.aSecondTierFlags ?? 0,
  bBaseFlagsDown: input?.bBaseFlagsDown ?? 0,
  bCenterFlagDown: input?.bCenterFlagDown ?? 0,
  cOpponentBackfieldBullets: input?.cOpponentBackfieldBullets ?? 0,
  dGoldFlagsDefended: input?.dGoldFlagsDefended ?? 0,
  dRobotParkState: input?.dRobotParkState ?? 0,
  scoreA: input?.scoreA ?? 0,
  scoreB: input?.scoreB ?? 0,
  scoreC: input?.scoreC ?? 0,
  scoreD: input?.scoreD ?? 0,
  scoreTotal: input?.scoreTotal ?? 0,
});

const loadInspectionScheduleRecords = (eventDb: Database) => {
  if (
    !(
      tableExists(eventDb, "inspection_schedule_items") &&
      tableExists(eventDb, "inspection_schedule_form")
    )
  ) {
    return [];
  }

  const stageRows = eventDb
    .query("SELECT id AS id, str AS stage FROM inspection_schedule_form")
    .all() as Array<{ id: number; stage: string }>;
  const stageById = new Map(stageRows.map((row) => [row.id, row.stage]));
  const rows = eventDb
    .query(
      `SELECT
        id AS stageId,
        team AS team,
        station_number AS stationNumber,
        start_time AS startTime,
        total_time AS totalTime
      FROM inspection_schedule_items
      ORDER BY id ASC, team ASC`
    )
    .all() as Array<{
    stageId: number;
    startTime: number;
    stationNumber: number;
    team: number;
    totalTime: number;
  }>;

  return rows.map((row) => ({
    externalInspectionItemId: `${row.stageId}:${row.team}`,
    stage: stageById.get(row.stageId) ?? "GENERAL",
    stationNumber: String(row.stationNumber),
    startsAt:
      row.startTime > 0 ? new Date(row.startTime).toISOString() : undefined,
    status: "SCHEDULED",
    teamNumber: String(row.team),
    durationMinutes: parsePositiveInteger(row.totalTime, 0),
  }));
};

const loadInspectionResultRecords = (eventDb: Database) => {
  if (!tableExists(eventDb, "inspections")) {
    return [];
  }

  const rows = eventDb
    .query(
      `SELECT
        team_number AS teamNumber,
        status AS status,
        comment AS comment,
        updated_at AS updatedAt
      FROM inspections
      ORDER BY team_number ASC`
    )
    .all() as Array<{
    comment: string | null;
    status: string;
    teamNumber: number;
    updatedAt: number;
  }>;

  return rows.map((row) => ({
    teamNumber: String(row.teamNumber),
    stage: "GENERAL",
    status: row.status,
    recordedAt: new Date(row.updatedAt || Date.now()).toISOString(),
    comment: row.comment ?? undefined,
  }));
};

const loadTeamRankingRecords = (eventDb: Database) => {
  if (!tableExists(eventDb, "team_ranking")) {
    return [];
  }

  const rows = eventDb
    .query(
      `SELECT
        fms_team_id AS fmsTeamId,
        ranking AS rank,
        rank_change AS rankChange,
        wins AS wins,
        losses AS losses,
        ties AS ties,
        matches_played AS matchesPlayed,
        qualifying_score AS qualifyingScore,
        points_scored_total AS pointsScoredTotal,
        points_scored_average AS pointsScoredAverage,
        sort_order_1 AS sortOrder1,
        sort_order_2 AS sortOrder2,
        sort_order_3 AS sortOrder3,
        sort_order_4 AS sortOrder4,
        sort_order_5 AS sortOrder5,
        sort_order_6 AS sortOrder6,
        modified_on AS modifiedOn
      FROM team_ranking
      ORDER BY ranking ASC`
    )
    .all() as Record<string, number | string | null>[];

  return rows.flatMap((row) => {
    const teamNumber = parseTeamNumberFromId(row.fmsTeamId);
    if (!teamNumber) {
      return [];
    }

    const sortOrders = [
      row.sortOrder1,
      row.sortOrder2,
      row.sortOrder3,
      row.sortOrder4,
      row.sortOrder5,
      row.sortOrder6,
    ]
      .map((value) => Number.parseFloat(String(value)))
      .filter((value) => Number.isFinite(value));

    const qualifyingScore = Number.parseFloat(String(row.qualifyingScore));
    const pointsScoredAverage = Number.parseFloat(
      String(row.pointsScoredAverage)
    );
    return [
      {
        teamNumber,
        rank: parsePositiveInteger(row.rank, 0),
        rankChange: parsePositiveInteger(row.rankChange, 0),
        wins: parsePositiveInteger(row.wins, 0),
        losses: parsePositiveInteger(row.losses, 0),
        ties: parsePositiveInteger(row.ties, 0),
        matchesPlayed: parsePositiveInteger(row.matchesPlayed, 0),
        qualifyingScore: Number.isFinite(qualifyingScore)
          ? qualifyingScore
          : undefined,
        pointsScoredTotal: parsePositiveInteger(row.pointsScoredTotal, 0),
        pointsScoredAverage: Number.isFinite(pointsScoredAverage)
          ? pointsScoredAverage
          : undefined,
        sortOrders: sortOrders.length > 0 ? sortOrders : undefined,
        modifiedAt:
          typeof row.modifiedOn === "string" && row.modifiedOn
            ? row.modifiedOn
            : undefined,
      },
    ];
  });
};

const loadTeamAwardRecords = (eventDb: Database) => {
  if (
    !(tableExists(eventDb, "award") && tableExists(eventDb, "award_assignment"))
  ) {
    return [];
  }

  const rows = eventDb
    .query(
      `SELECT
        a.fms_award_id AS fmsAwardId,
        a.award_id AS awardId,
        a.description AS awardName,
        a.display_order_ui AS displayOrder,
        aa.fms_team_id AS fmsTeamId,
        aa.first_name AS recipient,
        aa.is_public AS isPublic,
        aa.comment AS comment,
        aa.modified_on AS modifiedOn,
        aa.created_on AS createdOn
      FROM award a
      LEFT JOIN award_assignment aa
        ON aa.fms_award_id = a.fms_award_id
      ORDER BY a.display_order_ui ASC, a.fms_award_id ASC`
    )
    .all() as Record<string, number | string | null>[];

  const byAwardCode = new Map<
    string,
    {
      assignedAt?: string;
      awardCode: string;
      awardName: string;
      comment?: string;
      displayOrder: number;
      isPublic: boolean;
      recipient?: string;
      teamNumber?: string;
    }
  >();
  for (const row of rows) {
    const awardCode = String(row.awardId ?? row.fmsAwardId ?? "");
    if (!awardCode || byAwardCode.has(awardCode)) {
      continue;
    }

    const modifiedAt = parseTimestamp(row.modifiedOn, 0);
    const createdAt = parseTimestamp(row.createdOn, 0);
    const assignedAt = modifiedAt > 0 ? modifiedAt : createdAt;
    byAwardCode.set(awardCode, {
      awardCode,
      awardName: String(row.awardName ?? awardCode),
      comment: typeof row.comment === "string" ? row.comment : undefined,
      displayOrder: parsePositiveInteger(row.displayOrder, 0),
      isPublic: parsePositiveInteger(row.isPublic, 0) > 0,
      recipient: typeof row.recipient === "string" ? row.recipient : undefined,
      teamNumber: parseTeamNumberFromId(row.fmsTeamId),
      assignedAt:
        assignedAt > 0 ? new Date(assignedAt).toISOString() : undefined,
    });
  }

  return [...byAwardCode.values()];
};

export const buildOutboundSyncPayload = async (input: {
  allowedResources: MachinePushResourceType[];
  definitionVersion?: string | null;
  eventCode: string;
}): Promise<PushSyncBatchRequestDto> => {
  const nowIso = new Date().toISOString();
  const [
    practiceSchedule,
    qualificationSchedule,
    practiceResults,
    qualificationResults,
    playoffResults,
  ] = await Promise.all([
    listPracticeMatchesUseCase.execute({ eventCode: input.eventCode }),
    listQualificationMatchesUseCase.execute({ eventCode: input.eventCode }),
    matchResultsUseCase.execute({
      eventCode: input.eventCode,
      matchType: "practice",
    }),
    matchResultsUseCase.execute({
      eventCode: input.eventCode,
      matchType: "quals",
    }),
    matchResultsUseCase.execute({
      eventCode: input.eventCode,
      matchType: "elims",
    }),
  ]);

  const nonPracticeResultDetails = new Map<
    string,
    Awaited<ReturnType<typeof matchScoresheetUseCase.execute>>
  >();
  for (const item of [...qualificationResults, ...playoffResults]) {
    const matchType = qualificationResults.includes(item) ? "quals" : "elims";
    const key = `${matchType}:${item.matchNumber}`;
    try {
      nonPracticeResultDetails.set(
        key,
        await matchScoresheetUseCase.execute({
          eventCode: input.eventCode,
          matchNumber: item.matchNumber,
          matchType,
        })
      );
    } catch {
      nonPracticeResultDetails.set(key, { blue: null, red: null });
    }
  }

  const dbRecords = withEventDb(input.eventCode, (eventDb) => ({
    inspectionSchedule: loadInspectionScheduleRecords(eventDb),
    inspectionResults: loadInspectionResultRecords(eventDb),
    teamAwards: loadTeamAwardRecords(eventDb),
    teamRankings: loadTeamRankingRecords(eventDb),
  }));

  const scheduleRecords = [
    ...practiceSchedule.matches.map((match) => ({
      matchKey: `P${match.matchNumber}`,
      phase: "PRACTICE" as const,
      matchNumber: match.matchNumber,
      scheduledAt: new Date(match.startTime).toISOString(),
      status: "SCHEDULED",
      alliances: [
        { color: "RED" as const, teamNumbers: [String(match.redTeam)] },
        { color: "BLUE" as const, teamNumbers: [String(match.blueTeam)] },
      ],
    })),
    ...qualificationSchedule.matches.map((match) => ({
      matchKey: `Q${match.matchNumber}`,
      phase: "QUALIFICATION" as const,
      matchNumber: match.matchNumber,
      scheduledAt: new Date(match.startTime).toISOString(),
      status: "SCHEDULED",
      alliances: [
        { color: "RED" as const, teamNumbers: [String(match.redTeam)] },
        { color: "BLUE" as const, teamNumbers: [String(match.blueTeam)] },
      ],
    })),
  ];

  const getPhase = (
    result: (typeof practiceResults)[0]
  ): "PRACTICE" | "QUALIFICATION" | "PLAYOFF" => {
    if (practiceResults.includes(result)) {
      return "PRACTICE";
    }
    if (qualificationResults.includes(result)) {
      return "QUALIFICATION";
    }
    return "PLAYOFF";
  };

  const getMatchKey = (phase: string, matchNumber: number): string => {
    let phasePrefix: string;
    if (phase === "PRACTICE") {
      phasePrefix = "P";
    } else if (phase === "QUALIFICATION") {
      phasePrefix = "Q";
    } else {
      phasePrefix = "E";
    }
    return `${phasePrefix}${matchNumber}`;
  };

  const getResultKey = (phase: string, matchNumber: number): string => {
    if (phase === "PRACTICE") {
      return `practice:${matchNumber}`;
    }
    if (phase === "QUALIFICATION") {
      return `quals:${matchNumber}`;
    }
    return `elims:${matchNumber}`;
  };

  const resultRecords = [
    ...practiceResults,
    ...qualificationResults,
    ...playoffResults,
  ].map((result) => {
    const phase = getPhase(result);
    const key = getResultKey(phase, result.matchNumber);
    const detail = nonPracticeResultDetails.get(key);
    const status =
      result.redScore !== null && result.blueScore !== null
        ? "POSTED"
        : "SCHEDULED";

    return {
      matchKey: getMatchKey(phase, result.matchNumber),
      phase,
      status,
      redScore: result.redScore ?? 0,
      blueScore: result.blueScore ?? 0,
      alliances: [
        { color: "RED" as const, teamNumbers: [String(result.redTeam)] },
        { color: "BLUE" as const, teamNumbers: [String(result.blueTeam)] },
      ],
      details:
        phase === "PRACTICE"
          ? undefined
          : {
              redAlliance: toScoreDetails(detail?.red ?? null),
              blueAlliance: toScoreDetails(detail?.blue ?? null),
            },
    };
  });

  return {
    schemaVersion: SYNC_SCHEMA_VERSION,
    definitionVersion:
      input.definitionVersion?.trim() || SYNC_DEFINITION_VERSION,
    batchId: `local-${input.eventCode}-${Date.now()}-${crypto.randomUUID()}`,
    producedAt: nowIso,
    source: {
      appVersion: "electrobun-rms-local",
      deviceId: "desktop-server",
    },
    resources: input.allowedResources.map((resourceType) => {
      const getRecords = (): Record<string, unknown>[] => {
        switch (resourceType) {
          case "inspection_schedule":
            return dbRecords.inspectionSchedule;
          case "inspection_results":
            return dbRecords.inspectionResults;
          case "match_schedule":
            return scheduleRecords;
          case "match_results":
            return resultRecords;
          case "team_rankings":
            return dbRecords.teamRankings;
          default:
            return dbRecords.teamAwards;
        }
      };

      return {
        resourceType,
        mode: RESOURCE_MODE_BY_TYPE[resourceType],
        records: getRecords(),
      };
    }),
  };
};
