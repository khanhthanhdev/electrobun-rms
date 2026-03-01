import type React from "react";
import { useEffect, useReducer, useState } from "react";
import {
  fetchPracticeSchedule,
  fetchQualificationSchedule,
  type OneVsOneScheduleMatch,
} from "@/features/events/schedule";
import { useMatchScoresheet } from "../../../features/scoring/hooks/use-match-results";
import { LoadingIndicator } from "../../../shared/components/loading-indicator";
import {
  MatchNoteForm,
  type MatchNoteFormData,
} from "../../../shared/components/match-note-form";

import type {
  MatchHistoryItem,
  MatchScoresheet,
  MatchType,
} from "../../../shared/types/scoring";

// ─── Types ───────────────────────────────────────────────────────────

type HrTab = "active" | "notes" | "timers" | "scoresheets";
type CardState = "none" | "yellow" | "2yellow" | "red";
type ParkingLabel = "Không" | "Một phần" | "Toàn bộ";
type NotesFilter = "match" | "team" | "meeting";
type AllianceView = "red" | "blue" | "both";

interface HeadRefereePageProps {
  eventCode: string;
  fieldNumber: string;
  onNavigate: (path: string) => void;
  token: string | null;
}

interface MatchBlock {
  label: string;
  match: OneVsOneScheduleMatch;
  type: "practice" | "qual";
}

interface AllianceFoulState {
  majorHr: number;
  minorHr: number;
  refBlueMajor: number;
  refBlueMinor: number;
  refRedMajor: number;
  refRedMinor: number;
}

type AllianceCardState = CardState;

// ─── Constants ───────────────────────────────────────────────────────

const CARD_CYCLE: CardState[] = ["none", "yellow", "2yellow", "red"];
const nextCard = (c: CardState): CardState =>
  CARD_CYCLE[(CARD_CYCLE.indexOf(c) + 1) % CARD_CYCLE.length];

const CARD_COLORS: Record<CardState, string> = {
  none: "#9ca3af",
  yellow: "#eab308",
  "2yellow": "#f59e0b",
  red: "#dc2626",
};

const CARD_LABELS: Record<CardState, string> = {
  none: "No Card",
  yellow: "Yellow",
  "2yellow": "2× Yellow",
  red: "Red",
};

const INITIAL_FOULS: AllianceFoulState = {
  refRedMinor: 0,
  refBlueMinor: 0,
  minorHr: 0,
  refRedMajor: 0,
  refBlueMajor: 0,
  majorHr: 0,
};

const INITIAL_CARDS: AllianceCardState = "none";

const TAB_ITEMS: { id: HrTab; label: string }[] = [
  { id: "active", label: "Active Match" },
  { id: "notes", label: "Notes" },
  { id: "timers", label: "Timers" },
  { id: "scoresheets", label: "Scoresheets" },
];

// ─── Hook: load matches ─────────────────────────────────────────────

const collectMatchBlocks = (
  resp: {
    config?: { fieldCount?: number };
    matches?: OneVsOneScheduleMatch[];
  } | null,
  type: "practice" | "qual",
  prefix: string,
  fieldNumber: string
): MatchBlock[] => {
  if (!resp?.matches) {
    return [];
  }
  const fieldCount = resp.config?.fieldCount ?? 1;
  const blocks: MatchBlock[] = [];
  for (const m of resp.matches) {
    const matchField = ((m.matchNumber - 1) % fieldCount) + 1;
    if (
      fieldNumber === "all" ||
      Number.parseInt(fieldNumber, 10) === matchField
    ) {
      blocks.push({ type, match: m, label: `${prefix} M${m.matchNumber}` });
    }
  }
  return blocks;
};

interface MatchBlocksState {
  error: string | null;
  isLoading: boolean;
  matches: MatchBlock[];
}

type MatchBlocksAction =
  | { type: "start" }
  | { type: "success"; matches: MatchBlock[] }
  | { type: "error"; error: string }
  | { type: "no_token" };

const matchBlocksReducer = (
  _state: MatchBlocksState,
  action: MatchBlocksAction
): MatchBlocksState => {
  switch (action.type) {
    case "start":
      return { matches: [], isLoading: true, error: null };
    case "success":
      return { matches: action.matches, isLoading: false, error: null };
    case "error":
      return { matches: [], isLoading: false, error: action.error };
    case "no_token":
      return {
        matches: [],
        isLoading: false,
        error: "Authentication required.",
      };
    default:
      return _state;
  }
};

const useMatchBlocks = (
  eventCode: string,
  fieldNumber: string,
  token: string | null
): { matches: MatchBlock[]; isLoading: boolean; error: string | null } => {
  const [state, dispatch] = useReducer(matchBlocksReducer, {
    matches: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    if (!token) {
      dispatch({ type: "no_token" });
      return;
    }

    let cancelled = false;
    dispatch({ type: "start" });

    Promise.all([
      fetchPracticeSchedule(eventCode, token).catch(() => null),
      fetchQualificationSchedule(eventCode, token).catch(() => null),
    ])
      .then(([pracResp, qualResp]) => {
        if (cancelled) {
          return;
        }
        const combined = [
          ...collectMatchBlocks(pracResp, "practice", "Practice", fieldNumber),
          ...collectMatchBlocks(qualResp, "qual", "Match", fieldNumber),
        ];
        combined.sort((a, b) => a.match.startTime - b.match.startTime);
        dispatch({ type: "success", matches: combined });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          dispatch({
            type: "error",
            error:
              err instanceof Error ? err.message : "Failed to load matches.",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [eventCode, fieldNumber, token]);

  return {
    matches: state.matches,
    isLoading: state.isLoading,
    error: state.error,
  };
};

// ─── Hook: current time ─────────────────────────────────────────────

const useCurrentTime = (): string => {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString("en-GB")
  );
  useEffect(() => {
    const id = setInterval(
      () => setTime(new Date().toLocaleTimeString("en-GB")),
      1000
    );
    return () => clearInterval(id);
  }, []);
  return time;
};

// ─── Helpers ─────────────────────────────────────────────────────────

const parseParkState = (state: number): ParkingLabel => {
  if (state === 1) {
    return "Một phần";
  }
  if (state === 2) {
    return "Toàn bộ";
  }
  return "Không";
};

const createDefaultScoresheetData = (
  alliance: "red" | "blue"
): MatchHistoryItem => ({
  ts: 0,
  alliance,
  aSecondTierFlags: 0,
  aFirstTierFlags: 0,
  aCenterFlags: 0,
  bCenterFlagDown: 0,
  bBaseFlagsDown: 0,
  cOpponentBackfieldBullets: 0,
  dRobotParkState: 0,
  dGoldFlagsDefended: 0,
  scoreA: 0,
  scoreB: 0,
  scoreC: 0,
  scoreD: 0,
  scoreTotal: 0,
});

const matchTypeFromLabel = (label: string): MatchType => {
  if (label.startsWith("Practice")) {
    return "practice";
  }
  return "quals";
};

// ─── Sub-components ─────────────────────────────────────────────────

const SectionHeader = ({
  label,
  accent,
}: {
  accent: string;
  label: string;
}): JSX.Element => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      marginTop: "0.6rem",
      marginBottom: "0rem",
      paddingBottom: "0.3rem",
      borderBottom: "1px solid var(--muted)",
    }}
  >
    <span
      style={{
        display: "inline-block",
        width: 3,
        height: "1rem",
        borderRadius: 2,
        background: accent,
        flexShrink: 0,
      }}
    />
    <span
      style={{
        fontWeight: "var(--font-bold)" as React.CSSProperties["fontWeight"],
        fontSize: "0.8rem",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "var(--foreground)",
      }}
    >
      {label}
    </span>
  </div>
);

// ─── Active Match Tab ───────────────────────────────────────────────

interface ActiveMatchTabProps {
  activeMatch: MatchBlock | null;
  blueCards: AllianceCardState;
  blueFouls: AllianceFoulState;
  fieldNumber: string;
  flipped: boolean;
  onAddNote: () => void;
  onChangeBlueCard: () => void;
  onChangeBlueFoul: (field: "minorHr" | "majorHr", delta: 1 | -1) => void;
  onChangeRedCard: () => void;
  onChangeRedFoul: (field: "minorHr" | "majorHr", delta: 1 | -1) => void;
  onFlip: () => void;
  redCards: AllianceCardState;
  redFouls: AllianceFoulState;
  scoresheet: MatchScoresheet | null;
  scoresheetLoading: boolean;
}

// Single foul cell — shows total, ref breakdown, and HR +/- controls
const FoulCell = ({
  fouls,
  foulKey,
  onDec,
  onInc,
}: {
  foulKey: "minorHr" | "majorHr";
  fouls: AllianceFoulState;
  onDec: () => void;
  onInc: () => void;
}): JSX.Element => {
  const refR = foulKey === "minorHr" ? fouls.refRedMinor : fouls.refRedMajor;
  const refB = foulKey === "minorHr" ? fouls.refBlueMinor : fouls.refBlueMajor;
  const hrVal = fouls[foulKey];
  const total = refR + refB + hrVal;
  return (
    <div>
      <div className="hr-foul-value">{total}</div>
      <div className="hr-foul-breakdown">
        {refR} / {refB}
      </div>
      <div className="hr-counter">
        <button className="hr-counter-btn" onClick={onDec} type="button">
          −
        </button>
        <span className="hr-counter-value">{hrVal}</span>
        <button className="hr-counter-btn" onClick={onInc} type="button">
          +
        </button>
      </div>
    </div>
  );
};

// Full scoring grid: Red (left) | Labels | Blue (right), with horizontally aligned foul rows
const ScoringGrid = ({
  blueFouls,
  redFouls,
  blueCards,
  redCards,
  blueTeam,
  redTeam,
  onChangeBlueFoul,
  onChangeRedFoul,
  onChangeBlueCard,
  onChangeRedCard,
  flipped,
}: {
  blueCards: AllianceCardState;
  blueFouls: AllianceFoulState;
  blueTeam: number;
  flipped: boolean;
  onChangeBlueCard: () => void;
  onChangeBlueFoul: (field: "minorHr" | "majorHr", delta: 1 | -1) => void;
  onChangeRedCard: () => void;
  onChangeRedFoul: (field: "minorHr" | "majorHr", delta: 1 | -1) => void;
  redCards: AllianceCardState;
  redFouls: AllianceFoulState;
  redTeam: number;
}): JSX.Element => {
  const leftFouls = flipped ? blueFouls : redFouls;
  const rightFouls = flipped ? redFouls : blueFouls;
  const leftCards = flipped ? blueCards : redCards;
  const rightCards = flipped ? redCards : blueCards;
  const leftColor: "blue" | "red" = flipped ? "blue" : "red";
  const rightColor: "blue" | "red" = flipped ? "red" : "blue";
  const leftTeam = flipped ? blueTeam : redTeam;
  const rightTeam = flipped ? redTeam : blueTeam;
  const leftFoulChange = flipped ? onChangeBlueFoul : onChangeRedFoul;
  const rightFoulChange = flipped ? onChangeRedFoul : onChangeBlueFoul;
  const leftCardChange = flipped ? onChangeBlueCard : onChangeRedCard;
  const rightCardChange = flipped ? onChangeRedCard : onChangeBlueCard;

  const leftTitleClass =
    leftColor === "blue" ? "hr-alliance-title--blue" : "hr-alliance-title--red";
  const rightTitleClass =
    rightColor === "blue"
      ? "hr-alliance-title--blue"
      : "hr-alliance-title--red";
  const leftLabel = leftColor === "blue" ? "Blue" : "Red";
  const rightLabel = rightColor === "blue" ? "Blue" : "Red";

  return (
    <div className="hr-scoring-grid">
      {/* Row 1: Alliance headers */}
      <div className="hr-alliance-col" style={{ padding: "0" }}>
        <div className={`hr-alliance-title ${leftTitleClass}`}>{leftLabel}</div>
      </div>
      <div className="hr-center-col" style={{ padding: "0" }}>
        <div className="hr-center-title" style={{ margin: 0 }}>
          Referee Status
        </div>
      </div>
      <div className="hr-alliance-col" style={{ padding: "0" }}>
        <div className={`hr-alliance-title ${rightTitleClass}`}>
          {rightLabel}
        </div>
      </div>

      {/* Row 2: Scoring phase label */}
      <div
        className="hr-alliance-col"
        style={{
          textAlign: "center",
          fontSize: "0.75rem",
          color: "var(--muted-foreground)",
        }}
      >
        INIT
      </div>
      <div
        className="hr-center-col"
        style={{ fontSize: "0.75rem", color: "var(--muted-foreground)" }}
      >
        Scoring Phase
      </div>
      <div
        className="hr-alliance-col"
        style={{
          textAlign: "center",
          fontSize: "0.75rem",
          color: "var(--muted-foreground)",
        }}
      >
        INIT
      </div>

      {/* Row 3: MINOR FOULS — Red value | Label | Blue value */}
      <div className="hr-alliance-col" style={{ padding: "0.5rem 0.75rem" }}>
        <FoulCell
          foulKey="minorHr"
          fouls={leftFouls}
          onDec={() => leftFoulChange("minorHr", -1)}
          onInc={() => leftFoulChange("minorHr", 1)}
        />
      </div>
      <div className="hr-center-col">
        <div className="hr-center-section">
          <div className="hr-center-section-title">MINOR FOULS</div>
          <div className="hr-center-section-sub">Total</div>
          <div className="hr-center-section-sub">Foul input: R / B</div>
        </div>
        <div className="hr-center-section">
          <div className="hr-center-section-title">HR MINOR FOULS</div>
        </div>
      </div>
      <div className="hr-alliance-col" style={{ padding: "0.5rem 0.75rem" }}>
        <FoulCell
          foulKey="minorHr"
          fouls={rightFouls}
          onDec={() => rightFoulChange("minorHr", -1)}
          onInc={() => rightFoulChange("minorHr", 1)}
        />
      </div>

      {/* Row 4: MAJOR FOULS — Red value | Label | Blue value */}
      <div className="hr-alliance-col" style={{ padding: "0.5rem 0.75rem" }}>
        <FoulCell
          foulKey="majorHr"
          fouls={leftFouls}
          onDec={() => leftFoulChange("majorHr", -1)}
          onInc={() => leftFoulChange("majorHr", 1)}
        />
      </div>
      <div className="hr-center-col">
        <div className="hr-center-section">
          <div className="hr-center-section-title">MAJOR FOULS</div>
          <div className="hr-center-section-sub">Total</div>
          <div className="hr-center-section-sub">Foul input: R / B</div>
        </div>
        <div className="hr-center-section">
          <div className="hr-center-section-title">HR MAJOR FOULS</div>
        </div>
      </div>
      <div className="hr-alliance-col" style={{ padding: "0.5rem 0.75rem" }}>
        <FoulCell
          foulKey="majorHr"
          fouls={rightFouls}
          onDec={() => rightFoulChange("majorHr", -1)}
          onInc={() => rightFoulChange("majorHr", 1)}
        />
      </div>

      {/* Row 5: Teams / Cards — Red team | "Assign Cards" | Blue team */}
      <div className="hr-alliance-col" style={{ padding: "0.5rem 0.75rem" }}>
        <div className="hr-team-badge">{leftTeam}</div>
        <div style={{ textAlign: "center" }}>
          <button
            className="hr-card-btn"
            onClick={leftCardChange}
            style={{
              borderColor: CARD_COLORS[leftCards],
              color: CARD_COLORS[leftCards],
            }}
            type="button"
          >
            {CARD_LABELS[leftCards]}
          </button>
        </div>
      </div>
      <div
        className="hr-center-col"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <button className="hr-btn" type="button">
          Assign Cards
        </button>
      </div>
      <div className="hr-alliance-col" style={{ padding: "0.5rem 0.75rem" }}>
        <div className="hr-team-badge">{rightTeam}</div>
        <div style={{ textAlign: "center" }}>
          <button
            className="hr-card-btn"
            onClick={rightCardChange}
            style={{
              borderColor: CARD_COLORS[rightCards],
              color: CARD_COLORS[rightCards],
            }}
            type="button"
          >
            {CARD_LABELS[rightCards]}
          </button>
        </div>
      </div>
    </div>
  );
};

const NormalScoresAccordion = ({
  blueData,
  redData,
  flipped,
}: {
  blueData: MatchHistoryItem;
  flipped: boolean;
  redData: MatchHistoryItem;
}): JSX.Element => {
  const [open, setOpen] = useState(false);
  const left = flipped ? blueData : redData;
  const right = flipped ? redData : blueData;

  const scoreRows = [
    {
      section: "A — Số cờ được bảo vệ",
      items: [
        {
          label: "Cờ tầng 2",
          pts: "25 điểm / 1",
          lVal: left.aSecondTierFlags,
          rVal: right.aSecondTierFlags,
        },
        {
          label: "Cờ tầng 1",
          pts: "20 điểm / 1",
          lVal: left.aFirstTierFlags,
          rVal: right.aFirstTierFlags,
        },
        {
          label: "Cờ trung tâm",
          pts: "10 điểm / 1",
          lVal: left.aCenterFlags,
          rVal: right.aCenterFlags,
        },
      ],
    },
    {
      section: "B — Bắn phá trên sân đối phương",
      items: [
        {
          label: "Bắn hạ cờ trung tâm",
          pts: "30 điểm / 1",
          lVal: left.bCenterFlagDown,
          rVal: right.bCenterFlagDown,
        },
        {
          label: "Bắn hạ cờ khác",
          pts: "10 điểm / 1",
          lVal: left.bBaseFlagsDown,
          rVal: right.bBaseFlagsDown,
        },
      ],
    },
    {
      section: "C — Số đạn trên sân đối phương",
      items: [
        {
          label: "Số đạn trên sân đối phương",
          pts: "loại bỏ cờ",
          lVal: left.cOpponentBackfieldBullets,
          rVal: right.cOpponentBackfieldBullets,
        },
      ],
    },
    {
      section: "D — Giai đoạn kết thúc trận đấu",
      items: [
        {
          label: "Vị trí đỗ",
          pts: "",
          lVal: parseParkState(left.dRobotParkState),
          rVal: parseParkState(right.dRobotParkState),
        },
        {
          label: "Bảo vệ cờ vàng",
          pts: "10 điểm / 1",
          lVal: left.dGoldFlagsDefended,
          rVal: right.dGoldFlagsDefended,
        },
      ],
    },
  ];

  return (
    <div style={{ marginTop: "0.75rem" }}>
      <button
        className="hr-accordion-toggle"
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        {open ? "▲" : "▼"} Normal Scores {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="hr-accordion-content">
          <div
            className="hr-scoring-grid"
            style={{ border: "none", marginTop: 0 }}
          >
            <div className="hr-alliance-col" style={{ padding: "0.25rem" }} />
            <div
              className="hr-center-col"
              style={{
                borderLeft: "none",
                borderRight: "none",
                padding: "0.25rem",
              }}
            />
            <div className="hr-alliance-col" style={{ padding: "0.25rem" }} />
          </div>
          {scoreRows.map((section) => (
            <div key={section.section}>
              <SectionHeader accent="#f97316" label={section.section} />
              {section.items.map((item) => (
                <div className="hr-score-row" key={item.label}>
                  <span
                    className="hr-foul-value"
                    style={{ flex: 1, fontSize: "1rem", padding: "0.3rem" }}
                  >
                    {item.lVal}
                  </span>
                  <span className="hr-score-label" style={{ flex: 2 }}>
                    {item.label}
                    {item.pts && (
                      <>
                        <br />
                        <span className="hr-score-pts">{item.pts}</span>
                      </>
                    )}
                  </span>
                  <span
                    className="hr-foul-value"
                    style={{ flex: 1, fontSize: "1rem", padding: "0.3rem" }}
                  >
                    {item.rVal}
                  </span>
                </div>
              ))}
            </div>
          ))}

          {/* Total Score */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "0.75rem",
              gap: "1rem",
            }}
          >
            <div className="hr-total-score" style={{ flex: 1 }}>
              <div className="hr-total-label">Total Score</div>
              <div className="hr-total-value">{left.scoreTotal}</div>
            </div>
            <div className="hr-total-score" style={{ flex: 1 }}>
              <div className="hr-total-label">Total Score</div>
              <div className="hr-total-value">{right.scoreTotal}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ActiveMatchTab = ({
  activeMatch,
  blueFouls,
  redFouls,
  blueCards,
  redCards,
  scoresheet,
  scoresheetLoading,
  onChangeBlueFoul,
  onChangeRedFoul,
  onChangeBlueCard,
  onChangeRedCard,
  onFlip,
  onAddNote,
  fieldNumber,
  flipped,
}: ActiveMatchTabProps): JSX.Element => {
  if (!activeMatch) {
    return (
      <div
        className="hr-content"
        style={{ textAlign: "center", color: "var(--muted-foreground)" }}
      >
        No active match available.
      </div>
    );
  }

  const matchLabel = activeMatch.label;
  const fieldLabel =
    fieldNumber === "all" ? "All Fields" : `Field: ${fieldNumber}`;
  const blueData = scoresheet?.blue ?? createDefaultScoresheetData("blue");
  const redData = scoresheet?.red ?? createDefaultScoresheetData("red");

  return (
    <div className="hr-content">
      {/* Match info */}
      <div className="hr-match-info">
        <h2 className="hr-match-name">{matchLabel}</h2>
        <p className="hr-match-detail">{fieldLabel}</p>
        <p className="hr-match-detail">Match Status: Unplayed</p>
      </div>

      {/* Controls */}
      <div className="hr-controls">
        <button className="hr-btn" onClick={onFlip} type="button">
          ⇄ Flip Alliances
        </button>
        <button className="hr-btn" onClick={onAddNote} type="button">
          + Add Note
        </button>
      </div>

      {/* Scoring grid: Red | Minor/Major labels | Blue */}
      <ScoringGrid
        blueCards={blueCards}
        blueFouls={blueFouls}
        blueTeam={activeMatch.match.blueTeam}
        flipped={flipped}
        onChangeBlueCard={onChangeBlueCard}
        onChangeBlueFoul={onChangeBlueFoul}
        onChangeRedCard={onChangeRedCard}
        onChangeRedFoul={onChangeRedFoul}
        redCards={redCards}
        redFouls={redFouls}
        redTeam={activeMatch.match.redTeam}
      />

      {/* Normal Scores (read-only accordion) */}
      {scoresheetLoading ? (
        <div style={{ marginTop: "1rem" }}>
          <LoadingIndicator />
        </div>
      ) : (
        <NormalScoresAccordion
          blueData={blueData}
          flipped={flipped}
          redData={redData}
        />
      )}
    </div>
  );
};

// ─── Notes Tab ──────────────────────────────────────────────────────

const NotesTab = ({ matches }: { matches: MatchBlock[] }): JSX.Element => {
  const [filter, setFilter] = useState<NotesFilter>("match");

  return (
    <div className="hr-content">
      <div className="hr-notes-filters">
        {(["match", "team", "meeting"] as const).map((f) => (
          <button
            className="hr-btn"
            key={f}
            onClick={() => setFilter(f)}
            style={
              filter === f
                ? {
                    borderColor: "#f97316",
                    color: "#f97316",
                    background: "#fff7ed",
                  }
                : {}
            }
            type="button"
          >
            {f === "match" && "By Match"}
            {f === "team" && "By Team"}
            {f === "meeting" && "Meeting ▼"}
          </button>
        ))}
      </div>

      <p className="hr-notes-hint">
        Tap on a row to open the notes for that match.
      </p>

      <table className="hr-notes-table">
        <thead>
          <tr>
            <th>Match</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {matches.map((mb) => (
            <tr key={`${mb.type}-${mb.match.matchNumber}`}>
              <td>{mb.label}</td>
              <td style={{ color: "var(--muted-foreground)" }}>—</td>
            </tr>
          ))}
          {matches.length === 0 && (
            <tr>
              <td
                colSpan={2}
                style={{
                  textAlign: "center",
                  color: "var(--muted-foreground)",
                }}
              >
                No matches found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

// ─── Timers Tab ─────────────────────────────────────────────────────

const TimersTab = ({
  activeMatch,
  matches,
}: {
  activeMatch: MatchBlock | null;
  matches: MatchBlock[];
}): JSX.Element => {
  const currentTime = useCurrentTime();

  return (
    <div className="hr-content">
      {activeMatch && (
        <div className="hr-timer-card">
          <h3 className="hr-timer-title">G301 Timing - {activeMatch.label}</h3>
          <p className="hr-timer-sub">
            Red: {activeMatch.match.redTeam} Blue: {activeMatch.match.blueTeam}
          </p>
          <div className="hr-timer-actions">
            <span className="hr-timer-warning">
              Match start time has passed!
            </span>
            <button className="hr-btn" type="button">
              Start 2-Minute Warning
            </button>
          </div>
        </div>
      )}

      <div className="hr-timer-card">
        <h3 className="hr-timer-title">All Timing</h3>
        <p className="hr-timer-sub">Current time: {currentTime}</p>

        <table className="hr-timer-table" style={{ marginTop: "0.75rem" }}>
          <thead>
            <tr>
              <th>M</th>
              <th>Type</th>
              <th>Start</th>
              <th>Length</th>
              <th>End</th>
              <th>Left</th>
            </tr>
          </thead>
          <tbody>
            {matches.slice(0, 6).map((mb) => {
              const startDate = new Date(mb.match.startTime * 1000);
              const endDate = new Date(mb.match.endTime * 1000);
              const startStr = startDate.toLocaleTimeString("en-GB");
              const endStr = endDate.toLocaleTimeString("en-GB");
              const durationMin = Math.round(
                (mb.match.endTime - mb.match.startTime) / 60
              );
              const now = Date.now() / 1000;
              const left = Math.max(0, mb.match.endTime - now);
              const leftStr =
                left <= 0
                  ? "0:00"
                  : `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, "0")}`;

              return (
                <tr key={`${mb.type}-${mb.match.matchNumber}`}>
                  <td>{mb.label}</td>
                  <td>Scheduled Time</td>
                  <td>{startStr}</td>
                  <td>{durationMin}:00</td>
                  <td>{endStr}</td>
                  <td className={left <= 0 ? "hr-timer-highlight" : ""}>
                    {leftStr}
                  </td>
                </tr>
              );
            })}
            {matches.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    textAlign: "center",
                    color: "var(--muted-foreground)",
                  }}
                >
                  No timing data available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Scoresheets Tab ────────────────────────────────────────────────

const AllianceScoresheetCard = ({
  data,
  alliance,
}: {
  alliance: "red" | "blue";
  data: MatchHistoryItem;
}): JSX.Element => {
  const accent = alliance === "red" ? "#dc2626" : "#0284c7";
  const allianceLabel = alliance === "red" ? "Red Alliance" : "Blue Alliance";

  return (
    <div className="surface-card surface-card--small">
      <div
        style={{
          backgroundColor: accent,
          color: "#fff",
          padding: "0.75rem 1rem",
          borderRadius: "var(--radius-medium) var(--radius-medium) 0 0",
          textAlign: "center",
          fontWeight: "var(--font-bold)" as React.CSSProperties["fontWeight"],
          fontSize: "1rem",
        }}
      >
        {allianceLabel}
      </div>
      <div
        className="card"
        style={{
          borderRadius: "0 0 var(--radius-medium) var(--radius-medium)",
          borderTop: "none",
          padding: "0.5rem 1rem 0.75rem",
        }}
      >
        <SectionHeader accent={accent} label="A — Số cờ được bảo vệ" />
        <ScoreDisplayRow
          label="Cờ tầng 2"
          pts="25 điểm / 1"
          value={data.aSecondTierFlags}
        />
        <ScoreDisplayRow
          label="Cờ tầng 1"
          pts="20 điểm / 1"
          value={data.aFirstTierFlags}
        />
        <ScoreDisplayRow
          label="Cờ trung tâm"
          pts="10 điểm / 1"
          value={data.aCenterFlags}
        />

        <SectionHeader
          accent={accent}
          label="B — Bắn phá trên sân đối phương"
        />
        <ScoreDisplayRow
          label="Bắn hạ cờ trung tâm"
          pts="30 điểm / 1"
          value={data.bCenterFlagDown}
        />
        <ScoreDisplayRow
          label="Bắn hạ cờ khác"
          pts="10 điểm / 1"
          value={data.bBaseFlagsDown}
        />

        <SectionHeader accent={accent} label="C — Số đạn trên sân đối phương" />
        <ScoreDisplayRow
          label="Số đạn trên sân đối phương"
          pts="loại bỏ cờ"
          value={data.cOpponentBackfieldBullets}
        />

        <SectionHeader
          accent={accent}
          label="D — Giai đoạn kết thúc trận đấu"
        />
        <ScoreDisplayRow
          label="Vị trí đỗ"
          pts={parseParkState(data.dRobotParkState)}
          value={0}
        />
        <ScoreDisplayRow
          label="Bảo vệ cờ vàng"
          pts="10 điểm / 1"
          value={data.dGoldFlagsDefended}
        />

        <div
          style={{
            marginTop: "0.75rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "var(--faint)",
            borderRadius: "var(--radius-medium)",
            padding: "0.5rem 0.75rem",
            border: "1px solid var(--muted)",
          }}
        >
          <span
            style={{
              fontWeight:
                "var(--font-bold)" as React.CSSProperties["fontWeight"],
              fontSize: "1rem",
              color: "var(--foreground)",
            }}
          >
            Tổng điểm
          </span>
          <span
            style={{
              fontWeight:
                "var(--font-bold)" as React.CSSProperties["fontWeight"],
              fontSize: "2rem",
              color: accent,
              lineHeight: 1,
            }}
          >
            {data.scoreTotal}
          </span>
        </div>
      </div>
    </div>
  );
};

const ScoreDisplayRow = ({
  label,
  value,
  pts,
}: {
  label: string;
  pts: string;
  value: number;
}): JSX.Element => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0.35rem 0",
      borderBottom: "1px solid var(--muted)",
    }}
  >
    <div>
      <span
        style={{
          fontWeight: "var(--font-medium)" as React.CSSProperties["fontWeight"],
          color: "var(--foreground)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          marginLeft: "0.5rem",
          fontSize: "0.78rem",
          color: "var(--muted-foreground)",
        }}
      >
        {pts}
      </span>
    </div>
    <span
      style={{
        fontWeight: "var(--font-bold)" as React.CSSProperties["fontWeight"],
        fontSize: "1.1rem",
        color: "var(--foreground)",
      }}
    >
      {value}
    </span>
  </div>
);

const ScoresheetsTab = ({
  eventCode,
  matches,
  token,
}: {
  eventCode: string;
  matches: MatchBlock[];
  token: string | null;
}): JSX.Element => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [allianceView, setAllianceView] = useState<AllianceView>("both");

  const selectedMatch = matches[selectedIdx] ?? null;
  const matchType = selectedMatch
    ? matchTypeFromLabel(selectedMatch.label)
    : "quals";
  const matchNumber = selectedMatch?.match.matchNumber ?? 0;

  const { scoresheet, isLoading, error } = useMatchScoresheet(
    eventCode,
    matchType,
    matchNumber,
    token,
    selectedMatch !== null
  );

  const blueData = scoresheet?.blue ?? createDefaultScoresheetData("blue");
  const redData = scoresheet?.red ?? createDefaultScoresheetData("red");

  return (
    <div className="hr-content">
      <div className="hr-scoresheet-controls">
        <label style={{ fontSize: "0.85rem", color: "var(--foreground)" }}>
          Match:{" "}
          <select
            className="hr-scoresheet-select"
            onChange={(e) => setSelectedIdx(Number(e.target.value))}
            value={selectedIdx}
          >
            {matches.map((mb, idx) => (
              <option key={`${mb.type}-${mb.match.matchNumber}`} value={idx}>
                {mb.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="hr-scoresheet-controls">
        <div className="hr-scoresheet-radio-group">
          {(["red", "blue", "both"] as const).map((v) => (
            <label key={v}>
              <input
                checked={allianceView === v}
                name="alliance-view"
                onChange={() => setAllianceView(v)}
                type="radio"
              />
              {v === "both" && "Both"}
              {v === "red" && "Red"}
              {v === "blue" && "Blue"}
            </label>
          ))}
        </div>
      </div>

      {error && (
        <p className="message-block" data-variant="danger" role="alert">
          {error}
        </p>
      )}

      {isLoading ? (
        <LoadingIndicator />
      ) : (
        <div
          className="hr-scoresheet-grid"
          style={allianceView !== "both" ? { gridTemplateColumns: "1fr" } : {}}
        >
          {(allianceView === "blue" || allianceView === "both") && (
            <AllianceScoresheetCard alliance="blue" data={blueData} />
          )}
          {(allianceView === "red" || allianceView === "both") && (
            <AllianceScoresheetCard alliance="red" data={redData} />
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Page ──────────────────────────────────────────────────────

export const HeadRefereePage = ({
  eventCode,
  fieldNumber,
  onNavigate,
  token,
}: HeadRefereePageProps): JSX.Element => {
  const [activeTab, setActiveTab] = useState<HrTab>("active");
  const [activeMatchIdx, setActiveMatchIdx] = useState(0);
  const [blueFouls, setBlueFouls] = useState<AllianceFoulState>(INITIAL_FOULS);
  const [redFouls, setRedFouls] = useState<AllianceFoulState>(INITIAL_FOULS);
  const [blueCards, setBlueCards] = useState<AllianceCardState>(INITIAL_CARDS);
  const [redCards, setRedCards] = useState<AllianceCardState>(INITIAL_CARDS);
  const [flipped, setFlipped] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);

  const { matches, isLoading, error } = useMatchBlocks(
    eventCode,
    fieldNumber,
    token
  );
  const activeMatch = matches[activeMatchIdx] ?? null;

  const matchType: MatchType = activeMatch
    ? matchTypeFromLabel(activeMatch.label)
    : "quals";
  const matchNumber = activeMatch?.match.matchNumber ?? 0;

  const { scoresheet, isLoading: scoresheetLoading } = useMatchScoresheet(
    eventCode,
    matchType,
    matchNumber,
    token,
    activeMatch !== null
  );

  const fieldLabel =
    fieldNumber === "all" ? "All Fields" : `Field ${fieldNumber}`;
  const backPath = `/event/${eventCode}/hr`;

  const changeFoul = (
    setter: React.Dispatch<React.SetStateAction<AllianceFoulState>>,
    field: "minorHr" | "majorHr",
    delta: 1 | -1
  ) => setter((f) => ({ ...f, [field]: Math.max(0, f[field] + delta) }));

  const changeCard = (
    setter: React.Dispatch<React.SetStateAction<AllianceCardState>>
  ) => {
    setter((c) => nextCard(c));
  };

  const handleAddNote = (data: MatchNoteFormData) => {
    // TODO: Save note data to backend/state
    console.log("Note saved:", data);
    setIsNoteModalOpen(false);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
      setIsFullscreen(false);
    } else {
      document.documentElement.requestFullscreen().catch(() => undefined);
      setIsFullscreen(true);
    }
  };

  if (isLoading) {
    return (
      <main className="page-shell page-shell--center">
        <LoadingIndicator />
      </main>
    );
  }

  if (error) {
    return (
      <main className="page-shell page-shell--center">
        <div className="card surface-card surface-card--small stack stack--compact">
          <p className="message-block" data-variant="danger" role="alert">
            {error}
          </p>
          <a
            className="app-link-inline"
            href={backPath}
            onClick={(e) => {
              e.preventDefault();
              onNavigate(backPath);
            }}
          >
            Back
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="hr-page">
      <div className="hr-container">
        {/* Header */}
        <div className="hr-header">
          <button
            className="hr-header-btn"
            onClick={() => onNavigate(backPath)}
            type="button"
          >
            ← Back
          </button>
          <span className="hr-header-title">Head Referee ({fieldLabel})</span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              className="hr-header-btn"
              onClick={toggleFullscreen}
              type="button"
            >
              {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </button>
            <button className="hr-header-btn" type="button">
              Help
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="hr-tabs">
          {TAB_ITEMS.map((tab) => (
            <button
              className={`hr-tab ${activeTab === tab.id ? "hr-tab--active" : ""}`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
          {/* Match selector (shown inline with tabs) */}
          {activeTab === "active" && matches.length > 1 && (
            <div
              style={{
                marginLeft: "auto",
                display: "flex",
                alignItems: "center",
                paddingRight: "0.75rem",
              }}
            >
              <select
                onChange={(e) => setActiveMatchIdx(Number(e.target.value))}
                style={{
                  padding: "0.3rem 0.5rem",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-small)",
                  fontSize: "0.8rem",
                  background: "var(--card)",
                  color: "var(--foreground)",
                }}
                value={activeMatchIdx}
              >
                {matches.map((mb, idx) => (
                  <option
                    key={`${mb.type}-${mb.match.matchNumber}`}
                    value={idx}
                  >
                    {mb.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Tab Content */}
        {activeTab === "active" && (
          <ActiveMatchTab
            activeMatch={activeMatch}
            blueCards={blueCards}
            blueFouls={blueFouls}
            fieldNumber={fieldNumber}
            flipped={flipped}
            onAddNote={() => setIsNoteModalOpen(true)}
            onChangeBlueCard={() => changeCard(setBlueCards)}
            onChangeBlueFoul={(f, d) => changeFoul(setBlueFouls, f, d)}
            onChangeRedCard={() => changeCard(setRedCards)}
            onChangeRedFoul={(f, d) => changeFoul(setRedFouls, f, d)}
            onFlip={() => setFlipped((f) => !f)}
            redCards={redCards}
            redFouls={redFouls}
            scoresheet={scoresheet}
            scoresheetLoading={scoresheetLoading}
          />
        )}

        {activeTab === "notes" && <NotesTab matches={matches} />}

        {activeTab === "timers" && (
          <TimersTab activeMatch={activeMatch} matches={matches} />
        )}

        {activeTab === "scoresheets" && (
          <ScoresheetsTab
            eventCode={eventCode}
            matches={matches}
            token={token}
          />
        )}
      </div>

      {/* Note Dialog */}
      <MatchNoteForm
        blueTeamName={activeMatch?.match.blueTeamName ?? ""}
        blueTeamNumber={String(activeMatch?.match.blueTeam ?? "")}
        matchId={activeMatch?.label ?? ""}
        onCancel={() => setIsNoteModalOpen(false)}
        onSave={handleAddNote}
        open={isNoteModalOpen}
        redTeamName={activeMatch?.match.redTeamName ?? ""}
        redTeamNumber={String(activeMatch?.match.redTeam ?? "")}
      />
    </main>
  );
};
