import { useEffect, useRef, useState } from "react";
import {
  calcScoringTotal,
  INITIAL_SCORING_STATE,
  PARKING_OPTIONS,
  PENALTY_SCORING_FIELD,
  SCORING_FORM_SECTIONS,
  SCORING_TOTAL_LABEL,
  type ScoringState,
} from "../scoring-business-logic";

export {
  calcScoringTotal,
  INITIAL_SCORING_STATE,
  type ParkingState,
  type ScoringState,
} from "../scoring-business-logic";

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
  onChange?: (score: ScoringState) => void;
  onSubmit?: (score: ScoringState) => void;
}

export const ScoringEntryForm = ({
  alliance,
  embedded = false,
  fieldLabel,
  initialScore,
  matchLabel,
  onChange,
  onBackClick,
  onSubmit,
}: ScoringEntryFormProps): JSX.Element => {
  const [score, setScore] = useState<ScoringState>({
    ...INITIAL_SCORING_STATE,
    ...initialScore,
  });
  const accent = ALLIANCE_COLOR[alliance];
  const allianceLabel = alliance === "red" ? "Red Team" : "Blue Team";
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    onChange?.(score);
  }, [score, onChange]);

  const dec = (key: keyof ScoringState) =>
    setScore((s) => ({ ...s, [key]: Math.max(0, (s[key] as number) - 1) }));
  const inc = (key: keyof ScoringState, max?: number) =>
    setScore((s) => {
      const next = (s[key] as number) + 1;
      return { ...s, [key]: max !== undefined ? Math.min(max, next) : next };
    });

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
      {SCORING_FORM_SECTIONS.slice(0, 3).map((section) => (
        <div key={section.key}>
          <SectionHeader accent={accent} label={section.label} />
          {section.fields.map((field) => (
            <CounterRow
              key={field.key}
              label={field.label}
              onDecrement={() => dec(field.key)}
              onIncrement={() => inc(field.key, field.max)}
              pts={field.pts}
              value={score[field.key]}
            />
          ))}
        </div>
      ))}
      <SectionHeader accent={accent} label={SCORING_FORM_SECTIONS[3].label} />
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
        <div>
          <span
            style={{
              fontWeight:
                "var(--font-medium)" as React.CSSProperties["fontWeight"],
              color: "var(--foreground)",
              flexShrink: 0,
            }}
          >
            {SCORING_FORM_SECTIONS[3].fields[0].label}
          </span>
          <span
            style={{
              marginLeft: "0.5rem",
              fontSize: "0.78rem",
              color: "var(--muted-foreground)",
            }}
          >
            {SCORING_FORM_SECTIONS[3].fields[0].pts}
          </span>
        </div>
        <div
          style={{
            display: "flex",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-small)",
            overflow: "hidden",
            flex: 1,
          }}
        >
          {PARKING_OPTIONS.map((opt, idx) => {
            const active = score.robotParking === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() =>
                  setScore((s) => ({ ...s, robotParking: opt.value }))
                }
                style={{
                  flex: 1,
                  padding: "0.35rem 0.7rem",
                  border: "none",
                  borderRight:
                    idx < PARKING_OPTIONS.length - 1
                      ? "1px solid var(--border)"
                      : "none",
                  background: active ? accent : "var(--card)",
                  color: active ? "#fff" : "var(--foreground)",
                  cursor: "pointer",
                  fontWeight: active
                    ? ("var(--font-semibold)" as React.CSSProperties["fontWeight"])
                    : ("var(--font-medium)" as React.CSSProperties["fontWeight"]),
                  fontSize: "0.82rem",
                  whiteSpace: "nowrap",
                  textAlign: "center",
                }}
                type="button"
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
      <SectionHeader accent={accent} label="Điểm trừ" />
      <CounterRow
        label={PENALTY_SCORING_FIELD.label}
        onDecrement={() => dec(PENALTY_SCORING_FIELD.key)}
        onIncrement={() => inc(PENALTY_SCORING_FIELD.key)}
        pts={PENALTY_SCORING_FIELD.pts}
        value={score[PENALTY_SCORING_FIELD.key]}
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
          {SCORING_TOTAL_LABEL}
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
        Ghi điểm
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
