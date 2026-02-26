import { useState } from "react";

interface HrMatchPageProps {
  eventCode: string;
  fieldNumber: string;
  matchNumber: number;
  onNavigate: (path: string) => void;
}

// Card state cycles: None → Yellow → Red → Yellow+Red
type CardState = "none" | "yellow" | "red" | "yellow+red";
const CARD_CYCLE: CardState[] = ["none", "yellow", "red", "yellow+red"];
const nextCard = (c: CardState): CardState =>
  CARD_CYCLE[(CARD_CYCLE.indexOf(c) + 1) % CARD_CYCLE.length];

const CARD_COLORS: Record<CardState, string> = {
  none: "#9ca3af",
  yellow: "#eab308",
  red: "#dc2626",
  "yellow+red": "#f97316",
};

interface AllianceFouls {
  majorB: number;
  majorHr: number;
  majorR: number;
  minorB: number;
  minorHr: number;
  minorR: number;
}

interface AllianceCards {
  team1: CardState;
  team2: CardState;
}

// Reusable foul row with per-referee inputs and HR override
const FoulRow = ({
  label,
  valueR,
  valueB,
  valueHr,
  onDecHr,
  onIncHr,
}: {
  label: string;
  onDecHr: () => void;
  onIncHr: () => void;
  valueB: number;
  valueHr: number;
  valueR: number;
}): JSX.Element => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      padding: "0.4rem 0",
      borderBottom: "1px solid #f3f4f6",
      fontSize: "0.9rem",
    }}
  >
    <span style={{ flex: 1, fontWeight: 500 }}>{label}</span>
    <span
      style={{ width: 32, textAlign: "center", color: "#dc2626" }}
      title="Red ref input"
    >
      {valueR}
    </span>
    <span
      style={{ width: 32, textAlign: "center", color: "#0284c7" }}
      title="Blue ref input"
    >
      {valueB}
    </span>
    <span
      style={{
        width: 24,
        textAlign: "center",
        color: "#6b7280",
        fontSize: "0.75rem",
      }}
    >
      +
    </span>
    <button onClick={onDecHr} style={btnStyle} type="button">
      −
    </button>
    <span style={{ width: 28, textAlign: "center", fontWeight: 700 }}>
      {valueHr}
    </span>
    <button onClick={onIncHr} style={btnStyle} type="button">
      +
    </button>
    <span style={{ width: 40, textAlign: "right", fontWeight: 600 }}>
      ={valueR + valueB + valueHr}
    </span>
  </div>
);

const btnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: "50%",
  border: "1px solid #d1d5db",
  background: "white",
  fontSize: "1rem",
  cursor: "pointer",
  lineHeight: 1,
};

const AlliancePanel = ({
  color,
  fouls,
  cards,
  onFoulChange,
  onCardChange,
}: {
  cards: AllianceCards;
  color: "red" | "blue";
  fouls: AllianceFouls;
  onCardChange: (team: "team1" | "team2") => void;
  onFoulChange: (field: keyof AllianceFouls, delta: 1 | -1) => void;
}): JSX.Element => {
  const headerBg = color === "red" ? "#dc2626" : "#0284c7";
  const label = color === "red" ? "Red Alliance" : "Blue Alliance";

  return (
    <div
      style={{
        flex: 1,
        border: "1px solid #e5e7eb",
        borderRadius: "0.25rem",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          backgroundColor: headerBg,
          color: "white",
          padding: "0.5rem 0.75rem",
          fontWeight: 700,
          fontSize: "0.9rem",
        }}
      >
        {label}
      </div>
      <div style={{ padding: "0.75rem" }}>
        {/* Foul header */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            fontSize: "0.72rem",
            color: "#6b7280",
            marginBottom: "0.25rem",
            paddingLeft: "0",
          }}
        >
          <span style={{ flex: 1 }} />
          <span style={{ width: 32, textAlign: "center" }}>R</span>
          <span style={{ width: 32, textAlign: "center" }}>B</span>
          <span style={{ width: 24 }} />
          <span style={{ width: 28 }} />
          <span style={{ width: 28, textAlign: "center" }}>HR</span>
          <span style={{ width: 28 }} />
          <span style={{ width: 40, textAlign: "right" }}>Tot</span>
        </div>

        <FoulRow
          label="Minor Fouls"
          onDecHr={() => onFoulChange("minorHr", -1)}
          onIncHr={() => onFoulChange("minorHr", 1)}
          valueB={fouls.minorB}
          valueHr={fouls.minorHr}
          valueR={fouls.minorR}
        />
        <FoulRow
          label="Major Fouls"
          onDecHr={() => onFoulChange("majorHr", -1)}
          onIncHr={() => onFoulChange("majorHr", 1)}
          valueB={fouls.majorB}
          valueHr={fouls.majorHr}
          valueR={fouls.majorR}
        />

        {/* Cards */}
        <div
          style={{
            marginTop: "0.75rem",
            fontWeight: 700,
            fontSize: "0.75rem",
            textTransform: "uppercase",
            color: "#374151",
            marginBottom: "0.25rem",
          }}
        >
          Cards
        </div>
        {(["team1", "team2"] as const).map((team, idx) => (
          <div
            key={team}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.35rem 0",
            }}
          >
            <span style={{ fontSize: "0.875rem" }}>Team {idx + 1}</span>
            <button
              onClick={() => onCardChange(team)}
              style={{
                padding: "0.3rem 0.75rem",
                border: "2px solid",
                borderColor: CARD_COLORS[cards[team]],
                borderRadius: "0.25rem",
                background: "white",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "0.8rem",
                color: CARD_COLORS[cards[team]],
                minWidth: 90,
              }}
              type="button"
            >
              {cards[team] === "none"
                ? "No Card"
                : cards[team].charAt(0).toUpperCase() + cards[team].slice(1)}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const INITIAL_FOULS: AllianceFouls = {
  minorR: 0,
  minorB: 0,
  minorHr: 0,
  majorR: 0,
  majorB: 0,
  majorHr: 0,
};
const INITIAL_CARDS: AllianceCards = { team1: "none", team2: "none" };

export const HrMatchPage = ({
  eventCode,
  fieldNumber,
  matchNumber,
  onNavigate,
}: HrMatchPageProps): JSX.Element => {
  const [redFouls, setRedFouls] = useState<AllianceFouls>(INITIAL_FOULS);
  const [blueFouls, setBlueFouls] = useState<AllianceFouls>(INITIAL_FOULS);
  const [redCards, setRedCards] = useState<AllianceCards>(INITIAL_CARDS);
  const [blueCards, setBlueCards] = useState<AllianceCards>(INITIAL_CARDS);
  const [reviewRequired, setReviewRequired] = useState(false);
  const [flipped, setFlipped] = useState(false);

  const fieldLabel =
    fieldNumber === "all" ? "All Fields" : `Field ${fieldNumber}`;
  const matchLabel = `Match M${matchNumber}`;
  const backPath = `/event/${eventCode}/hr/${fieldNumber}`;

  const changeFoul = (
    setter: React.Dispatch<React.SetStateAction<AllianceFouls>>,
    field: keyof AllianceFouls,
    delta: 1 | -1
  ) => setter((f) => ({ ...f, [field]: Math.max(0, f[field] + delta) }));

  const changeCard = (
    setter: React.Dispatch<React.SetStateAction<AllianceCards>>,
    team: "team1" | "team2"
  ) => {
    setter((c) => ({ ...c, [team]: nextCard(c[team]) }));
    // If any card assigned, auto-lock review required
    setReviewRequired(true);
  };

  // Allow flipping alliance display order
  const panels = [
    <AlliancePanel
      cards={redCards}
      color="red"
      fouls={redFouls}
      key="red"
      onCardChange={(t) => changeCard(setRedCards, t)}
      onFoulChange={(f, d) => changeFoul(setRedFouls, f, d)}
    />,
    <AlliancePanel
      cards={blueCards}
      color="blue"
      fouls={blueFouls}
      key="blue"
      onCardChange={(t) => changeCard(setBlueCards, t)}
      onFoulChange={(f, d) => changeFoul(setBlueFouls, f, d)}
    />,
  ];

  return (
    <main
      style={{
        backgroundColor: "#f9fafb",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: "2rem",
        paddingBottom: "2rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: 800, padding: "0 1rem" }}>
        {/* Header */}
        <div
          style={{
            backgroundColor: "#f97316",
            color: "white",
            padding: "0.75rem 1rem",
            borderRadius: "0.25rem 0.25rem 0 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <button
            onClick={() => onNavigate(backPath)}
            style={{
              background: "none",
              border: "none",
              color: "white",
              cursor: "pointer",
              fontSize: "0.9rem",
              opacity: 0.85,
            }}
            type="button"
          >
            ← Back
          </button>
          <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>
            Head Referee — {matchLabel}
          </span>
          <span style={{ fontSize: "0.85rem", opacity: 0.85 }}>
            {fieldLabel}
          </span>
        </div>

        {/* Controls bar */}
        <div
          style={{
            backgroundColor: "white",
            borderLeft: "1px solid #e5e7eb",
            borderRight: "1px solid #e5e7eb",
            borderBottom: "1px solid #e5e7eb",
            padding: "0.6rem 1rem",
            display: "flex",
            gap: "0.75rem",
            alignItems: "center",
          }}
        >
          <button
            onClick={() => setFlipped((f) => !f)}
            style={{
              padding: "0.35rem 0.75rem",
              border: "1px solid #d1d5db",
              borderRadius: "0.25rem",
              background: "white",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
            type="button"
          >
            ⇄ Flip Alliances
          </button>

          <button
            onClick={() => setReviewRequired((r) => !r)}
            style={{
              padding: "0.35rem 0.75rem",
              border: "2px solid",
              borderColor: reviewRequired ? "#dc2626" : "#d1d5db",
              borderRadius: "0.25rem",
              background: reviewRequired ? "#fef2f2" : "white",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: reviewRequired ? 700 : 400,
              color: reviewRequired ? "#dc2626" : "#374151",
            }}
            type="button"
          >
            {reviewRequired ? "🔴 Review Required" : "Review Required?"}
          </button>
        </div>

        {/* Alliance panels side-by-side */}
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem" }}>
          {flipped ? [panels[1], panels[0]] : panels}
        </div>

        {/* Note hint */}
        <p
          style={{
            marginTop: "0.75rem",
            fontSize: "0.8rem",
            color: "#9ca3af",
            textAlign: "center",
          }}
        >
          R / B columns show per-referee foul inputs · HR column = Head Referee
          override
        </p>
      </div>
    </main>
  );
};
