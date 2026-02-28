import { useState } from "react";

// Parking states: 0=none, 1=partial(10pts), 2=full(15pts)
export type ParkingState = 0 | 1 | 2;

export interface ScoringState {
  bulletsInEnemyZone: number;
  flagsCenterDefended: number;
  flagsCenterShot: number;
  flagsL1Defended: number;
  flagsL2Defended: number;
  flagsOtherShot: number;
  goldenFlagsBonus: number;
  robotParking: ParkingState;
}

export const INITIAL_SCORING_STATE: ScoringState = {
  flagsL2Defended: 0,
  flagsL1Defended: 0,
  flagsCenterDefended: 0,
  flagsCenterShot: 0,
  flagsOtherShot: 0,
  bulletsInEnemyZone: 0,
  robotParking: 0,
  goldenFlagsBonus: 0,
};

export const calcScoringTotal = (s: ScoringState): number => {
  const scoreA =
    s.flagsL2Defended * 25 +
    s.flagsL1Defended * 20 +
    s.flagsCenterDefended * 10;
  const scoreB = s.flagsCenterShot * 30 + s.flagsOtherShot * 10;
  const scoreC = -(s.bulletsInEnemyZone * 10);
  const getParkingPts = (p: ParkingState): number => {
    if (p === 2) {
      return 15;
    }
    if (p === 1) {
      return 10;
    }
    return 0;
  };
  const scoreD = getParkingPts(s.robotParking) + s.goldenFlagsBonus * 10;
  return Math.max(0, scoreA + scoreB + scoreC + scoreD);
};

const PARKING_OPTIONS: { label: string; value: ParkingState }[] = [
  { value: 0, label: "Không" },
  { value: 1, label: "Một phần" },
  { value: 2, label: "Toàn bộ" },
];

const ALLIANCE_COLOR: Record<"red" | "blue", string> = {
  red: "#dc2626",
  blue: "#0284c7",
};

const CounterRow = ({
  label,
  value,
  onDecrement,
  onIncrement,
  pts,
}: {
  label: string;
  onDecrement: () => void;
  onIncrement: () => void;
  pts: string;
  value: number;
}): JSX.Element => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0.6rem 0",
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
    <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
      <button
        onClick={onDecrement}
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          border: "1px solid var(--border)",
          background: "var(--card)",
          fontSize: "1.15rem",
          cursor: "pointer",
          lineHeight: 1,
          color: "var(--foreground)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        type="button"
      >
        −
      </button>
      <span
        style={{
          minWidth: 28,
          textAlign: "center",
          fontWeight: "var(--font-bold)" as React.CSSProperties["fontWeight"],
          fontSize: "1.1rem",
          color: "var(--foreground)",
        }}
      >
        {value}
      </span>
      <button
        onClick={onIncrement}
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          border: "1px solid var(--border)",
          background: "var(--card)",
          fontSize: "1.15rem",
          cursor: "pointer",
          lineHeight: 1,
          color: "var(--foreground)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        type="button"
      >
        +
      </button>
    </div>
  </div>
);

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
      marginTop: "1.25rem",
      marginBottom: "0.1rem",
      paddingBottom: "0.4rem",
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

interface ScoringEntryFormProps {
  alliance: "red" | "blue";
  embedded?: boolean;
  fieldLabel?: string;
  initialScore?: Partial<ScoringState>;
  matchLabel?: string;
  onBackClick?: () => void;
  onSubmit?: (score: ScoringState) => void;
}

export const ScoringEntryForm = ({
  alliance,
  embedded = false,
  fieldLabel,
  initialScore,
  matchLabel,
  onBackClick,
  onSubmit,
}: ScoringEntryFormProps): JSX.Element => {
  const [score, setScore] = useState<ScoringState>({
    ...INITIAL_SCORING_STATE,
    ...initialScore,
  });
  const accent = ALLIANCE_COLOR[alliance];
  const allianceLabel = alliance === "red" ? "Red Alliance" : "Blue Alliance";

  const dec = (key: keyof ScoringState) =>
    setScore((s) => ({ ...s, [key]: Math.max(0, (s[key] as number) - 1) }));
  const inc = (key: keyof ScoringState) =>
    setScore((s) => ({ ...s, [key]: (s[key] as number) + 1 }));

  const handleSubmit = (): void => {
    onSubmit?.(score);
  };

  const total = calcScoringTotal(score);

  const formBody = (
    <div
      className="card"
      style={{
        borderRadius: embedded
          ? "var(--radius-medium)"
          : "0 0 var(--radius-medium) var(--radius-medium)",
        borderTop: embedded ? "1px solid var(--border)" : "none",
        padding: "0.75rem 1.25rem 1.25rem",
      }}
    >
      <SectionHeader accent={accent} label="A — Số cờ được bảo vệ" />
      <CounterRow
        label="Cờ tầng 2"
        onDecrement={() => dec("flagsL2Defended")}
        onIncrement={() => inc("flagsL2Defended")}
        pts="25 điểm / 1"
        value={score.flagsL2Defended}
      />
      <CounterRow
        label="Cờ tầng 1"
        onDecrement={() => dec("flagsL1Defended")}
        onIncrement={() => inc("flagsL1Defended")}
        pts="20 điểm / 1"
        value={score.flagsL1Defended}
      />
      <CounterRow
        label="Cờ trung tâm"
        onDecrement={() => dec("flagsCenterDefended")}
        onIncrement={() => inc("flagsCenterDefended")}
        pts="10 điểm / 1"
        value={score.flagsCenterDefended}
      />
      <SectionHeader accent={accent} label="B — Bắn phá trên sân đối phương" />
      <CounterRow
        label="Bắn hạ cờ trung tâm"
        onDecrement={() => dec("flagsCenterShot")}
        onIncrement={() => inc("flagsCenterShot")}
        pts="30 điểm / 1"
        value={score.flagsCenterShot}
      />
      <CounterRow
        label="Bắn hạ cờ khác"
        onDecrement={() => dec("flagsOtherShot")}
        onIncrement={() => inc("flagsOtherShot")}
        pts="10 điểm / 1"
        value={score.flagsOtherShot}
      />
      <SectionHeader accent={accent} label="C — Số đạn trên sân đối phương" />
      <CounterRow
        label="Số đạn trên sân đối phương"
        onDecrement={() => dec("bulletsInEnemyZone")}
        onIncrement={() => inc("bulletsInEnemyZone")}
        pts="Loại bỏ cờ"
        value={score.bulletsInEnemyZone}
      />
      <SectionHeader accent={accent} label="D — Giai đoạn kết thúc trận đấu" />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.6rem 0",
          borderBottom: "1px solid var(--muted)",
          gap: "0.5rem",
        }}
      >
        <span
          style={{
            fontWeight:
              "var(--font-medium)" as React.CSSProperties["fontWeight"],
            color: "var(--foreground)",
            flexShrink: 0,
          }}
        >
          Vị trí đỗ
        </span>
        <div
          style={{
            display: "flex",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-small)",
            overflow: "hidden",
          }}
        >
          {PARKING_OPTIONS.map((opt) => {
            const active = score.robotParking === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() =>
                  setScore((s) => ({ ...s, robotParking: opt.value }))
                }
                style={{
                  padding: "0.35rem 0.7rem",
                  border: "none",
                  borderRight:
                    opt.value < 2 ? "1px solid var(--border)" : "none",
                  background: active ? accent : "var(--card)",
                  color: active ? "#fff" : "var(--foreground)",
                  cursor: "pointer",
                  fontWeight: active
                    ? ("var(--font-semibold)" as React.CSSProperties["fontWeight"])
                    : ("var(--font-medium)" as React.CSSProperties["fontWeight"]),
                  fontSize: "0.82rem",
                  whiteSpace: "nowrap",
                }}
                type="button"
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
      <CounterRow
        label="Bảo vệ cờ vàng"
        onDecrement={() => dec("goldenFlagsBonus")}
        onIncrement={() => inc("goldenFlagsBonus")}
        pts="10 điểm / 1"
        value={score.goldenFlagsBonus}
      />
      <div
        style={{
          marginTop: "1.25rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--faint)",
          borderRadius: "var(--radius-medium)",
          padding: "0.75rem 1rem",
          border: "1px solid var(--muted)",
        }}
      >
        <span
          style={{
            fontWeight: "var(--font-bold)" as React.CSSProperties["fontWeight"],
            fontSize: "1rem",
            color: "var(--foreground)",
          }}
        >
          Total Score
        </span>
        <span
          style={{
            fontWeight: "var(--font-bold)" as React.CSSProperties["fontWeight"],
            fontSize: "2rem",
            color: accent,
            lineHeight: 1,
          }}
        >
          {total}
        </span>
      </div>
      <button
        onClick={handleSubmit}
        style={{
          marginTop: "1rem",
          width: "100%",
          padding: "0.875rem",
          backgroundColor: accent,
          color: "#fff",
          border: "none",
          borderRadius: "var(--radius-medium)",
          fontSize: "1rem",
          fontWeight: "var(--font-bold)" as React.CSSProperties["fontWeight"],
          cursor: "pointer",
        }}
        type="button"
      >
        Submit Score
      </button>
    </div>
  );

  if (embedded) {
    return (
      <div
        className="scoring-entry-form scoring-entry-form--embedded"
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-medium)",
        }}
      >
        <div
          style={{
            backgroundColor: accent,
            color: "#fff",
            padding: "0.5rem 0.75rem",
            borderRadius: "var(--radius-medium) var(--radius-medium) 0 0",
            fontWeight: "var(--font-bold)" as React.CSSProperties["fontWeight"],
            fontSize: "0.9rem",
          }}
        >
          {allianceLabel}
          {matchLabel || fieldLabel ? (
            <span
              style={{ marginLeft: "0.5rem", opacity: 0.9, fontSize: "0.8rem" }}
            >
              {[matchLabel, fieldLabel].filter(Boolean).join(" · ")}
            </span>
          ) : null}
        </div>
        {formBody}
      </div>
    );
  }

  return (
    <div className="surface-card surface-card--small">
      <div
        style={{
          backgroundColor: accent,
          color: "#fff",
          padding: "0.75rem 1rem",
          borderRadius: "var(--radius-medium) var(--radius-medium) 0 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {onBackClick ? (
          <button
            onClick={onBackClick}
            style={{
              background: "none",
              border: "none",
              color: "#fff",
              cursor: "pointer",
              fontSize: "0.9rem",
              opacity: 0.9,
              padding: 0,
            }}
            title="Back to Selection"
            type="button"
          >
            <span className="back-text" style={{ display: "none" }}>
              Back to Selection
            </span>
            ←
          </button>
        ) : (
          <span />
        )}
        <span
          style={{
            fontWeight: "var(--font-bold)" as React.CSSProperties["fontWeight"],
            fontSize: "1rem",
          }}
        >
          {allianceLabel} Scoring
        </span>
        <span style={{ fontSize: "0.8rem", opacity: 0.85 }}>
          {[matchLabel, fieldLabel].filter(Boolean).join(" · ")}
        </span>
      </div>
      {formBody}
    </div>
  );
};
