import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const teams = sqliteTable("teams", {
  number: integer("number").notNull().primaryKey(),
  advancement: integer("advancement").notNull(),
  division: integer("division").notNull(),
  inspireEligible: integer("inspire_eligible").notNull(),
  promoteEligible: integer("promote_eligible").notNull(),
  competing: text("competing").notNull(),
});

export const formRows = sqliteTable("form_rows", {
  formId: text("form_id").notNull(),
  row: integer("row").notNull(),
  type: text("type").notNull(),
  columnCount: integer("column_count").notNull(),
  description: text("description").notNull(),
  rule: text("rule"),
});

export const formItems = sqliteTable("form_items", {
  formId: text("form_id").notNull(),
  row: integer("row").notNull(),
  itemIndex: integer("item_index").notNull(),
  label: text("label"),
  type: text("type"),
  automationData: text("automation_data"),
  options: text("options"),
});

export const status = sqliteTable("status", {
  team: integer("team").notNull(),
  stage: text("stage").notNull(),
  status: integer("status").notNull(),
});

export const practiceMatchSchedule = sqliteTable("practice_match_schedule", {
  start: integer("start").notNull(),
  end: integer("end").notNull(),
  type: integer("type").notNull(),
  label: text("label").notNull(),
});

export const practiceBlocks = sqliteTable("practice_blocks", {
  start: integer("start").notNull(),
  end: integer("end").notNull(),
  type: text("type").notNull(),
  cycleTime: integer("cycle_time").notNull(),
  label: text("label"),
});

export const matchSchedule = sqliteTable("match_schedule", {
  start: integer("start").notNull(),
  end: integer("end").notNull(),
  type: integer("type").notNull(),
  label: text("label").notNull(),
});

export const blocks = sqliteTable("blocks", {
  start: integer("start").notNull(),
  end: integer("end").notNull(),
  type: text("type").notNull(),
  cycleTime: integer("cycle_time").notNull(),
  label: text("label"),
});

export const selections = sqliteTable("selections", {
  id: integer("id").notNull().primaryKey(),
  op: integer("op").notNull(),
  method: integer("method").notNull(),
  team: integer("team").notNull(),
});

export const alliances = sqliteTable("alliances", {
  rank: integer("rank").notNull(),
  team1: integer("team1").notNull(),
  team2: integer("team2").notNull(),
  team3: integer("team3").notNull(),
});

export const practice = sqliteTable("practice", {
  match: integer("match").notNull(),
  red1: integer("red1").notNull(),
  red1s: integer("red1s").notNull(),
  red2: integer("red2").notNull(),
  red2s: integer("red2s").notNull(),
  blue1: integer("blue1").notNull(),
  blue1s: integer("blue1s").notNull(),
  blue2: integer("blue2").notNull(),
  blue2s: integer("blue2s").notNull(),
});

export const practiceData = sqliteTable("practice_data", {
  match: integer("match").notNull(),
  status: integer("status").notNull(),
  randomization: integer("randomization").notNull(),
  start: integer("start").notNull(),
  scheduleStart: integer("schedule_start").notNull(),
  postedTime: integer("posted_time").notNull(),
  fmsMatchId: text("fms_match_id").notNull(),
  fmsScheduleDetailId: text("fms_schedule_detail_id").notNull(),
});

export const quals = sqliteTable("quals", {
  match: integer("match").notNull(),
  red1: integer("red1").notNull(),
  red1s: integer("red1s").notNull(),
  red2: integer("red2").notNull(),
  red2s: integer("red2s").notNull(),
  blue1: integer("blue1").notNull(),
  blue1s: integer("blue1s").notNull(),
  blue2: integer("blue2").notNull(),
  blue2s: integer("blue2s").notNull(),
});

export const qualsData = sqliteTable("quals_data", {
  match: integer("match").notNull(),
  status: integer("status").notNull(),
  randomization: integer("randomization").notNull(),
  start: integer("start").notNull(),
  scheduleStart: integer("schedule_start").notNull(),
  postedTime: integer("posted_time").notNull(),
  fmsMatchId: text("fms_match_id").notNull(),
  fmsScheduleDetailId: text("fms_schedule_detail_id").notNull(),
});

export const qualsResults = sqliteTable("quals_results", {
  match: integer("match").notNull().primaryKey(),
  redScore: integer("red_score").notNull(),
  blueScore: integer("blue_score").notNull(),
  redPenaltyCommitted: integer("red_penalty_committed").notNull(),
  bluePenaltyCommitted: integer("blue_penalty_committed").notNull(),
});

export const qualsScores = sqliteTable("quals_scores", {
  match: integer("match").notNull(),
  alliance: integer("alliance").notNull(),
  card1: integer("card1").notNull(),
  card2: integer("card2").notNull(),
  dq1: integer("dq1").notNull(),
  dq2: integer("dq2").notNull(),
  noshow1: integer("noshow1").notNull(),
  noshow2: integer("noshow2").notNull(),
  major: integer("major").notNull(),
  minor: integer("minor").notNull(),
  adjust: integer("adjust").notNull(),
});

export const qualsGameSpecific = sqliteTable("quals_game_specific", {
  match: integer("match").notNull(),
  alliance: integer("alliance").notNull(),
  autoClassifiedArtifacts: integer("auto_classified_artifacts").notNull(),
  autoOverflowArtifacts: integer("auto_overflow_artifacts").notNull(),
  autoClassifierState: text("auto_classifier_state").notNull(),
  robot1auto: integer("robot1auto").notNull(),
  robot2auto: integer("robot2auto").notNull(),
  teleopClassifiedArtifacts: integer("teleop_classified_artifacts").notNull(),
  teleopOverflowArtifacts: integer("teleop_overflow_artifacts").notNull(),
  teleopDepotArtifacts: integer("teleop_depot_artifacts").notNull(),
  teleopClassifierState: text("teleop_classifier_state").notNull(),
  robot1teleop: integer("robot1teleop").notNull(),
  robot2teleop: integer("robot2teleop").notNull(),
  violations: text("violations").notNull(),
  ownMajor: integer("own_major").notNull(),
  ownMinor: integer("own_minor").notNull(),
  otherMajor: integer("other_major").notNull(),
  otherMinor: integer("other_minor").notNull(),
  hrMajor: integer("hr_major").notNull(),
  hrMinor: integer("hr_minor").notNull(),
});

export const elims = sqliteTable("elims", {
  match: integer("match").notNull(),
  red: integer("red").notNull(),
  blue: integer("blue").notNull(),
});

export const elimsData = sqliteTable("elims_data", {
  match: integer("match").notNull(),
  status: integer("status").notNull(),
  randomization: integer("randomization").notNull(),
  start: integer("start").notNull(),
  postedTime: integer("posted_time").notNull(),
  fmsMatchId: text("fms_match_id").notNull(),
  fmsScheduleDetailId: text("fms_schedule_detail_id").notNull(),
});

export const elimsResults = sqliteTable("elims_results", {
  match: integer("match").notNull(),
  redScore: integer("red_score").notNull(),
  blueScore: integer("blue_score").notNull(),
  redPenaltyCommitted: integer("red_penalty_committed").notNull(),
  bluePenaltyCommitted: integer("blue_penalty_committed").notNull(),
});

export const elimsScores = sqliteTable("elims_scores", {
  match: integer("match").notNull(),
  alliance: integer("alliance").notNull(),
  card: integer("card").notNull(),
  dq: integer("dq").notNull(),
  noshow1: integer("noshow1").notNull(),
  noshow2: integer("noshow2").notNull(),
  noshow3: integer("noshow3").notNull(),
  major: integer("major").notNull(),
  minor: integer("minor").notNull(),
  adjust: integer("adjust").notNull(),
});

export const elimsGameSpecific = sqliteTable("elims_game_specific", {
  match: integer("match").notNull(),
  alliance: integer("alliance").notNull(),
  autoClassifiedArtifacts: integer("auto_classified_artifacts").notNull(),
  autoOverflowArtifacts: integer("auto_overflow_artifacts").notNull(),
  autoClassifierState: text("auto_classifier_state").notNull(),
  robot1auto: integer("robot1auto").notNull(),
  robot2auto: integer("robot2auto").notNull(),
  teleopClassifiedArtifacts: integer("teleop_classified_artifacts").notNull(),
  teleopOverflowArtifacts: integer("teleop_overflow_artifacts").notNull(),
  teleopDepotArtifacts: integer("teleop_depot_artifacts").notNull(),
  teleopClassifierState: text("teleop_classifier_state").notNull(),
  robot1teleop: integer("robot1teleop").notNull(),
  robot2teleop: integer("robot2teleop").notNull(),
  violations: text("violations").notNull(),
  ownMajor: integer("own_major").notNull(),
  ownMinor: integer("own_minor").notNull(),
  otherMajor: integer("other_major").notNull(),
  otherMinor: integer("other_minor").notNull(),
  hrMajor: integer("hr_major").notNull(),
  hrMinor: integer("hr_minor").notNull(),
});

export const qualsCommitHistory = sqliteTable("quals_commit_history", {
  match: integer("match").notNull(),
  ts: integer("ts").notNull(),
  start: integer("start").notNull(),
  random: integer("random").notNull(),
  type: integer("type").notNull(),
});

export const elimsCommitHistory = sqliteTable("elims_commit_history", {
  match: integer("match").notNull(),
  ts: integer("ts").notNull(),
  start: integer("start").notNull(),
  random: integer("random").notNull(),
  type: integer("type").notNull(),
});

export const qualsScoresHistory = sqliteTable("quals_scores_history", {
  match: integer("match").notNull(),
  ts: integer("ts").notNull(),
  alliance: integer("alliance").notNull(),
  card1: integer("card1").notNull(),
  card2: integer("card2").notNull(),
  dq1: integer("dq1").notNull(),
  dq2: integer("dq2").notNull(),
  noshow1: integer("noshow1").notNull(),
  noshow2: integer("noshow2").notNull(),
  major: integer("major").notNull(),
  minor: integer("minor").notNull(),
  adjust: integer("adjust").notNull(),
});

export const qualsGameSpecificHistory = sqliteTable(
  "quals_game_specific_history",
  {
    match: integer("match").notNull(),
    ts: integer("ts").notNull(),
    alliance: integer("alliance").notNull(),
    autoClassifiedArtifacts: integer("auto_classified_artifacts").notNull(),
    autoOverflowArtifacts: integer("auto_overflow_artifacts").notNull(),
    autoClassifierState: text("auto_classifier_state").notNull(),
    robot1auto: integer("robot1auto").notNull(),
    robot2auto: integer("robot2auto").notNull(),
    teleopClassifiedArtifacts: integer("teleop_classified_artifacts").notNull(),
    teleopOverflowArtifacts: integer("teleop_overflow_artifacts").notNull(),
    teleopDepotArtifacts: integer("teleop_depot_artifacts").notNull(),
    teleopClassifierState: text("teleop_classifier_state").notNull(),
    robot1teleop: integer("robot1teleop").notNull(),
    robot2teleop: integer("robot2teleop").notNull(),
    violations: text("violations").notNull(),
    ownMajor: integer("own_major").notNull(),
    ownMinor: integer("own_minor").notNull(),
    otherMajor: integer("other_major").notNull(),
    otherMinor: integer("other_minor").notNull(),
    hrMajor: integer("hr_major").notNull(),
    hrMinor: integer("hr_minor").notNull(),
  }
);

export const elimsScoresHistory = sqliteTable("elims_scores_history", {
  match: integer("match").notNull(),
  ts: integer("ts").notNull(),
  alliance: integer("alliance").notNull(),
  card: integer("card").notNull(),
  dq: integer("dq").notNull(),
  noshow1: integer("noshow1").notNull(),
  noshow2: integer("noshow2").notNull(),
  noshow3: integer("noshow3").notNull(),
  major: integer("major").notNull(),
  minor: integer("minor").notNull(),
  adjust: integer("adjust").notNull(),
});

export const elimsGameSpecificHistory = sqliteTable(
  "elims_game_specific_history",
  {
    match: integer("match").notNull(),
    ts: integer("ts").notNull(),
    alliance: integer("alliance").notNull(),
    autoClassifiedArtifacts: integer("auto_classified_artifacts").notNull(),
    autoOverflowArtifacts: integer("auto_overflow_artifacts").notNull(),
    autoClassifierState: text("auto_classifier_state").notNull(),
    robot1auto: integer("robot1auto").notNull(),
    robot2auto: integer("robot2auto").notNull(),
    teleopClassifiedArtifacts: integer("teleop_classified_artifacts").notNull(),
    teleopOverflowArtifacts: integer("teleop_overflow_artifacts").notNull(),
    teleopDepotArtifacts: integer("teleop_depot_artifacts").notNull(),
    teleopClassifierState: text("teleop_classifier_state").notNull(),
    robot1teleop: integer("robot1teleop").notNull(),
    robot2teleop: integer("robot2teleop").notNull(),
    violations: text("violations").notNull(),
    ownMajor: integer("own_major").notNull(),
    ownMinor: integer("own_minor").notNull(),
    otherMajor: integer("other_major").notNull(),
    otherMinor: integer("other_minor").notNull(),
    hrMajor: integer("hr_major").notNull(),
    hrMinor: integer("hr_minor").notNull(),
  }
);

export const inspectionScheduleForm = sqliteTable("inspection_schedule_form", {
  id: integer("id").notNull(),
  str: text("str").notNull(),
});

export const inspectionScheduleItems = sqliteTable(
  "inspection_schedule_items",
  {
    id: integer("id").notNull(),
    team: integer("team").notNull(),
    name: text("name").notNull(),
    stationNumber: integer("station_number").notNull(),
    startTime: integer("start_time").notNull(),
    totalTime: integer("total_time").notNull(),
    month: integer("month").notNull(),
    day: integer("day").notNull(),
    year: integer("year").notNull(),
  }
);

export const sponsors = sqliteTable("sponsors", {
  sponsorId: text("sponsor_id").notNull(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  position: integer("position").notNull(),
  logo: text("logo").notNull(),
  level: integer("level").notNull(),
});

export const config = sqliteTable("config", {
  key: text("key").notNull().primaryKey(),
  value: text("value"),
});

export const hrMeetingNotes = sqliteTable("hr_meeting_notes", {
  type: text("type").notNull(),
  content: text("content").notNull(),
});

export const systemSurveySamples = sqliteTable("system_survey_samples", {
  surveyType: text("survey_type").notNull(),
  sampleTime: integer("sample_time").notNull(),
  sampleDescription: text("sample_description").notNull(),
  data: text("data").notNull(),
});

export const award = sqliteTable("award", {
  fmsAwardId: text("fms_award_id").notNull().primaryKey(),
  fmsSeasonId: text("fms_season_id").notNull(),
  awardId: integer("award_id").notNull(),
  awardSubtypeId: integer("award_subtype_id").notNull(),
  tournamentType: integer("tournament_type").notNull(),
  type: integer("type").notNull(),
  cultureType: integer("culture_type").notNull(),
  description: text("description").notNull(),
  defaultQuantity: text("default_quantity"),
  sponsorDetails: text("sponsor_details"),
  displayOrderUi: integer("display_order_ui").notNull(),
  displayOrderOnline: integer("display_order_online").notNull(),
  cmpQualifying: integer("cmp_qualifying").notNull(),
  allowManualEntry: integer("allow_manual_entry").notNull(),
  createdOn: text("created_on").notNull(),
  createdBy: text("created_by"),
  modifiedOn: text("modified_on").notNull(),
  modifiedBy: text("modified_by"),
  script: text("script").notNull(),
  canEdit: integer("can_edit").notNull(),
});

export const awardAssignment = sqliteTable("award_assignment", {
  fmsAwardId: text("fms_award_id").notNull(),
  fmsEventId: text("fms_event_id").notNull(),
  series: integer("series").notNull(),
  fmsTeamId: text("fms_team_id"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  isPublic: integer("is_public").notNull(),
  createdOn: text("created_on").notNull(),
  createdBy: text("created_by").notNull(),
  modifiedOn: text("modified_on"),
  modifiedBy: text("modified_by"),
  comment: text("comment"),
});

export const teamRanking = sqliteTable("team_ranking", {
  fmsEventId: text("fms_event_id").notNull(),
  fmsTeamId: text("fms_team_id").notNull(),
  ranking: integer("ranking").notNull(),
  rankChange: integer("rank_change").notNull(),
  wins: integer("wins").notNull(),
  losses: integer("losses").notNull(),
  ties: integer("ties").notNull(),
  qualifyingScore: text("qualifying_score").notNull(),
  pointsScoredTotal: real("points_scored_total").notNull(),
  pointsScoredAverage: text("points_scored_average").notNull(),
  pointsScoredAverageChange: integer("points_scored_average_change").notNull(),
  matchesPlayed: integer("matches_played").notNull(),
  matchesCounted: integer("matches_counted").notNull(),
  disqualified: integer("disqualified").notNull(),
  sortOrder1: text("sort_order1").notNull(),
  sortOrder2: text("sort_order2").notNull(),
  sortOrder3: text("sort_order3").notNull(),
  sortOrder4: text("sort_order4").notNull(),
  sortOrder5: text("sort_order5").notNull(),
  sortOrder6: text("sort_order6").notNull(),
  modifiedOn: text("modified_on").notNull(),
});

export const team = sqliteTable("team", {
  fmsTeamId: text("fms_team_id").notNull(),
  fmsSeasonId: text("fms_season_id"),
  fmsRegionId: text("fms_region_id"),
  teamId: integer("team_id").notNull(),
  teamNumber: integer("team_number").notNull(),
  teamNameLong: text("team_name_long"),
  teamNameShort: text("team_name_short").notNull(),
  robotName: text("robot_name"),
  city: text("city").notNull(),
  stateProv: text("state_prov").notNull(),
  country: text("country").notNull(),
  website: text("website"),
  rookieYear: integer("rookie_year").notNull(),
  wasAddedFromUi: integer("was_added_from_ui").notNull(),
  cmpPrequalified: integer("cmp_prequalified").notNull(),
  schoolName: text("school_name"),
  demoTeam: integer("demo_team").notNull(),
  paid: integer("paid").notNull(),
  fmsHomeCmpId: text("fms_home_cmp_id"),
  gameSpecifics: text("game_specifics"),
  createdOn: text("created_on").notNull(),
  createdBy: text("created_by").notNull(),
  modifiedOn: text("modified_on").notNull(),
  modifiedBy: text("modified_by").notNull(),
});

export const scheduleDetail = sqliteTable("schedule_detail", {
  fmsScheduleDetailId: text("fms_schedule_detail_id").notNull(),
  fmsEventId: text("fms_event_id").notNull(),
  tournamentLevel: integer("tournament_level").notNull(),
  matchNumber: integer("match_number").notNull(),
  fieldType: integer("field_type").notNull(),
  description: text("description").notNull(),
  startTime: text("start_time").notNull(),
  fieldConfigurationDetails: text("field_configuration_details"),
  createdOn: text("created_on"),
  createdBy: text("created_by").notNull(),
  modifiedOn: text("modified_on"),
  modifiedBy: text("modified_by"),
  rowVersion: text("row_version").notNull(),
});

export const scheduleStation = sqliteTable("schedule_station", {
  fmsScheduleDetailId: text("fms_schedule_detail_id").notNull(),
  alliance: integer("alliance").notNull(),
  station: integer("station").notNull(),
  fmsEventId: text("fms_event_id").notNull(),
  fmsTeamId: text("fms_team_id").notNull(),
  isSurrogate: integer("is_surrogate").notNull(),
  createdOn: text("created_on"),
  createdBy: text("created_by").notNull(),
  modifiedOn: text("modified_on"),
  modifiedBy: text("modified_by"),
});

export const match = sqliteTable("match", {
  fmsMatchId: text("fms_match_id").notNull(),
  fmsScheduleDetailId: text("fms_schedule_detail_id").notNull(),
  playNumber: integer("play_number").notNull(),
  fieldType: integer("field_type").notNull(),
  initialPreStartTime: text("initial_pre_start_time"),
  finalPreStartTime: text("final_pre_start_time"),
  preStartCount: integer("pre_start_count").notNull(),
  autoStartTime: text("auto_start_time").notNull(),
  autoEndTime: text("auto_end_time").notNull(),
  teleopStartTime: text("teleop_start_time").notNull(),
  teleopEndTime: text("teleop_end_time"),
  refCommitTime: text("ref_commit_time"),
  scoreKeeperCommitTime: text("score_keeper_commit_time").notNull(),
  postMatchTime: text("post_match_time"),
  cancelMatchTime: text("cancel_match_time"),
  cycleTime: text("cycle_time"),
  redScore: integer("red_score").notNull(),
  blueScore: integer("blue_score").notNull(),
  redPenalty: integer("red_penalty").notNull(),
  bluePenalty: integer("blue_penalty").notNull(),
  redAutoScore: integer("red_auto_score").notNull(),
  blueAutoScore: integer("blue_auto_score").notNull(),
  scoreDetails: text("score_details").notNull(),
  headRefReview: integer("head_ref_review").notNull(),
  videoUrl: text("video_url"),
  createdOn: text("created_on").notNull(),
  createdBy: text("created_by").notNull(),
  modifiedOn: text("modified_on").notNull(),
  modifiedBy: text("modified_by").notNull(),
  fmsEventId: text("fms_event_id"),
  rowVersion: text("row_version").notNull(),
});

export const patches = sqliteTable("patches", {
  patchId: text("patch_id").notNull(),
  dbVersion: integer("db_version").notNull(),
  patch: text("patch").notNull(),
  applied: integer("applied").notNull(),
});

export const advancementPoints = sqliteTable("advancement_points", {
  team: integer("team").notNull(),
  sortTuple: text("sort_tuple").notNull(),
  privatePoints: integer("private_points").notNull(),
});
