import type React from "react";
import { useState } from "react";
import { useMatchScoresheet } from "../../../features/scoring/hooks/use-match-results";
import { LoadingIndicator } from "../../../shared/components/loading-indicator";
import type {
  MatchHistoryItem,
  MatchScoresheet,
  MatchType,
} from "../../../shared/types/scoring";

interface MatchScoresheetPageProps {
  allianceFilter?: "red" | "blue"; // Optional filter to show only one side
  eventCode: string;
  matchName: string;
  onNavigate: (path: string) => void;
  token: string | null;
}

const MATCH_NAME_REGEX = /^([QEP])(\d+)$/i;

const parseMatchName = (
  matchName: string
): { matchType: MatchType; matchNumber: number } | null => {
  const match = MATCH_NAME_REGEX.exec(matchName);
  if (!match) {
    return null;
  }

  const typeKey = match[1].toUpperCase();
  let type: MatchType = "elims";
  if (typeKey === "P") {
    type = "practice";
  } else if (typeKey === "Q") {
    type = "quals";
  }
  const num = Number.parseInt(match[2], 10);

  if (Number.isNaN(num) || num <= 0) {
    return null;
  }

  return { matchType: type, matchNumber: num };
};

const ALLIANCE_COLOR: Record<"red" | "blue", string> = {
  red: "#dc2626",
  blue: "#0284c7",
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

const ScoreRow = ({
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

const AllianceScoresheet = ({
  data,
  alliance,
}: {
  data: MatchHistoryItem | null;
  alliance: "red" | "blue";
}) => {
  const isRed = alliance === "red";
  const scoresheetData = data ?? createDefaultScoresheetData(alliance);
  const accent = ALLIANCE_COLOR[alliance];

  const parseParkState = (state: number) => {
    if (state === 1) {
      return "Một phần";
    }
    if (state === 2) {
      return "Toàn bộ";
    }
    return "Không";
  };

  return (
    <div className="surface-card surface-card--small">
      <div
        style={{
          backgroundColor: accent,
          color: "#fff",
          padding: "0.75rem 1rem",
          borderRadius: "var(--radius-medium) var(--radius-medium) 0 0",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontWeight: "var(--font-bold)" as React.CSSProperties["fontWeight"],
            fontSize: "1rem",
          }}
        >
          {isRed ? "Red" : "Blue"} Alliance Scoring
        </span>
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
        <ScoreRow
          label="Cờ tầng 2"
          pts="25 điểm / 1"
          value={scoresheetData.aSecondTierFlags}
        />
        <ScoreRow
          label="Cờ tầng 1"
          pts="20 điểm / 1"
          value={scoresheetData.aFirstTierFlags}
        />
        <ScoreRow
          label="Cờ trung tâm"
          pts="10 điểm / 1"
          value={scoresheetData.aCenterFlags}
        />

        <SectionHeader
          accent={accent}
          label="B — Bắn phá trên sân đối phương"
        />
        <ScoreRow
          label="Bắn hạ cờ trung tâm"
          pts="30 điểm / 1"
          value={scoresheetData.bCenterFlagDown}
        />
        <ScoreRow
          label="Bắn hạ cờ khác"
          pts="10 điểm / 1"
          value={scoresheetData.bBaseFlagsDown}
        />

        <SectionHeader accent={accent} label="C — Số đạn trên sân đối phương" />
        <ScoreRow
          label="Số đạn trên sân đối phương"
          pts="loại bỏ cờ"
          value={scoresheetData.cOpponentBackfieldBullets}
        />

        <SectionHeader
          accent={accent}
          label="D — Giai đoạn kết thúc trận đấu"
        />
        <ScoreRow
          label="Vị trí đỗ"
          pts={`${parseParkState(scoresheetData.dRobotParkState)}`}
          value={scoresheetData.dRobotParkState}
        />
        <ScoreRow
          label="Bảo vệ cờ vàng"
          pts="10 điểm / 1"
          value={scoresheetData.dGoldFlagsDefended}
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
            {scoresheetData.scoreTotal}
          </span>
        </div>
      </div>
    </div>
  );
};

const MobileAllianceSelector = ({
  mobileAllianceView,
  onSelect,
}: {
  mobileAllianceView: "red" | "blue" | "all";
  onSelect: (alliance: "red" | "blue" | "all") => void;
}) => (
  <fieldset className="scoresheet-mobile-toggle">
    <legend className="scoresheet-mobile-toggle-legend">
      Alliance selector
    </legend>
    <button
      aria-pressed={mobileAllianceView === "red"}
      className={`scoresheet-mobile-toggle-btn ${
        mobileAllianceView === "red" ? "active" : ""
      }`}
      onClick={() => onSelect("red")}
      type="button"
    >
      Red
    </button>
    <button
      aria-pressed={mobileAllianceView === "blue"}
      className={`scoresheet-mobile-toggle-btn ${
        mobileAllianceView === "blue" ? "active" : ""
      }`}
      onClick={() => onSelect("blue")}
      type="button"
    >
      Blue
    </button>
    <button
      aria-pressed={mobileAllianceView === "all"}
      className={`scoresheet-mobile-toggle-btn ${
        mobileAllianceView === "all" ? "active" : ""
      }`}
      onClick={() => onSelect("all")}
      type="button"
    >
      All
    </button>
  </fieldset>
);

export const ScoresheetGrid = ({
  allianceFilter,
  mobileView,
  scoresheet,
  showMobileSelector,
}: {
  allianceFilter?: "red" | "blue";
  mobileView?: "red" | "blue" | "all";
  scoresheet: MatchScoresheet | null;
  showMobileSelector?: boolean;
}) => {
  let showBlue = true;
  if (allianceFilter) {
    showBlue = allianceFilter === "blue";
  } else if (showMobileSelector) {
    showBlue = mobileView === "blue" || mobileView === "all";
  }

  let showRed = true;
  if (allianceFilter) {
    showRed = allianceFilter === "red";
  } else if (showMobileSelector) {
    showRed = mobileView === "red" || mobileView === "all";
  }

  return (
    <div
      className={
        allianceFilter
          ? "scoresheet-grid-container single"
          : "scoresheet-grid-container"
      }
    >
      {showRed && (
        <div
          style={
            allianceFilter === "blue" && mobileView !== "all"
              ? { display: "none" }
              : {}
          }
        >
          <AllianceScoresheet alliance="red" data={scoresheet?.red ?? null} />
        </div>
      )}
      {showBlue && (
        <div
          style={
            allianceFilter === "red" && mobileView !== "all"
              ? { display: "none" }
              : {}
          }
        >
          <AllianceScoresheet alliance="blue" data={scoresheet?.blue ?? null} />
        </div>
      )}
    </div>
  );
};

export const MatchScoresheetPage = ({
  eventCode,
  matchName,
  allianceFilter,
  onNavigate,
  token,
}: MatchScoresheetPageProps): JSX.Element => {
  const parsed = parseMatchName(matchName);
  const getInitialView = (): "red" | "blue" | "all" => {
    if (allianceFilter === "red") {
      return "red";
    }
    if (allianceFilter === "blue") {
      return "blue";
    }
    return "all";
  };

  const [mobileAllianceView, setMobileAllianceView] = useState<
    "red" | "blue" | "all"
  >(getInitialView());

  const { scoresheet, isLoading, error } = useMatchScoresheet(
    eventCode,
    parsed?.matchType ?? "quals",
    parsed?.matchNumber ?? 0,
    token,
    parsed !== null
  );
  const shouldRenderScoresheetGrid = !(isLoading || error);
  const showMobileSelector = !allianceFilter && shouldRenderScoresheetGrid;

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate(`/event/${eventCode}/results`);
  };

  if (!parsed) {
    return (
      <main className="page-shell">
        <div className="card surface-card">
          <p className="message-block" data-variant="danger">
            Invalid match name: {matchName}
          </p>
          <a
            className="app-link-inline"
            href={`/event/${eventCode}/results`}
            onClick={handleBack}
          >
            Back to Match Results
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="card surface-card match-results-container scoresheet-container">
        <header className="match-results-header">
          <a
            className="app-link-inline match-results-back"
            href={`/event/${eventCode}/results`}
            onClick={handleBack}
          >
            ←<span className="back-text"> Back to Match Results</span>
          </a>

          <div className="match-results-title-wrapper">
            <h1 className="match-results-title">Scoresheet for {matchName}</h1>
          </div>
        </header>

        {error && (
          <p className="message-block" data-variant="danger" role="alert">
            {error}
          </p>
        )}

        {isLoading ? <LoadingIndicator /> : null}
        {showMobileSelector ? (
          <MobileAllianceSelector
            mobileAllianceView={mobileAllianceView}
            onSelect={setMobileAllianceView}
          />
        ) : null}
        {shouldRenderScoresheetGrid ? (
          <ScoresheetGrid
            allianceFilter={allianceFilter}
            mobileView={mobileAllianceView}
            scoresheet={scoresheet}
            showMobileSelector={showMobileSelector}
          />
        ) : null}
      </div>
    </main>
  );
};
