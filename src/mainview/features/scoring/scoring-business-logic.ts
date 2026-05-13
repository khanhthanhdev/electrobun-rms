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

export type ScoreBreakdownKey = "a" | "b" | "c" | "d";

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

export const PARKING_OPTIONS: ReadonlyArray<{
  label: string;
  value: ParkingState;
}> = [
  { value: 0, label: "0" },
  { value: 1, label: "0.5" },
  { value: 2, label: "1" },
];

export const SCORING_TOTAL_LABEL = "Tổng điểm";

export const PENALTY_SCORING_FIELD = {
  key: "bulletsInEnemyZone",
  label: "Lúa đã cắm bị rơi",
  pts: "-1 điểm / cây",
} as const satisfies {
  key: keyof ScoringState;
  label: string;
  pts: string;
};

export const SCORING_FORM_SECTIONS = [
  {
    key: "a",
    label: "A — Lúa bảo vệ",
    displayLabel: "Lúa bảo vệ",
    scoresheetLabel: "A — Lúa bảo vệ",
    fields: [
      {
        key: "flagsL2Defended",
        label: "Lúa tầng 2",
        pts: "2 điểm / cây",
      },
      {
        key: "flagsL1Defended",
        label: "Lúa tầng 1",
        pts: "1 điểm / cây",
      },
      {
        key: "flagsCenterDefended",
        label: "Lúa trung tâm",
        pts: "2 điểm / cây",
      },
    ],
  },
  {
    key: "b",
    label: "B — Phân bón vào ô đích",
    displayLabel: "Phân bón",
    scoresheetLabel: "B — Phân bón vào ô đích",
    fields: [
      {
        key: "flagsCenterShot",
        label: "Phân bón vào ô đích",
        pts: "+1 điểm / viên (max +10)",
        max: 10,
      },
    ],
  },
  {
    key: "c",
    label: "C — Cây Lúa Vàng",
    displayLabel: "Lúa vàng",
    scoresheetLabel: "C — Cây Lúa Vàng",
    fields: [
      {
        key: "goldenFlagsBonus",
        label: "Lúa vàng tại Căn cứ",
        pts: "5 điểm / cây",
      },
    ],
  },
  {
    key: "d",
    label: "D — Vị trí đỗ",
    displayLabel: "Vị trí đỗ",
    scoresheetLabel: "D — Vị trí đỗ",
    fields: [
      {
        key: "robotParking",
        label: "Vị trí đỗ robot",
        pts: "",
      },
    ],
  },
] as const satisfies ReadonlyArray<{
  displayLabel: string;
  fields: ReadonlyArray<{
    key: keyof ScoringState;
    label: string;
    max?: number;
    pts: string;
  }>;
  key: ScoreBreakdownKey;
  label: string;
  scoresheetLabel: string;
}>;

export const SCORE_BREAKDOWN_ROWS = SCORING_FORM_SECTIONS.map(
  ({ key, displayLabel }) => ({ key, label: displayLabel })
);

export const formatParkingState = (state: number): string =>
  PARKING_OPTIONS.find((option) => option.value === state)?.label ?? "Không";

export const getParkingPoints = (parking: ParkingState): number => {
  if (parking === 2) {
    return 3;
  }
  if (parking === 1) {
    return 2;
  }
  return 0;
};

export const calcScoringTotal = (score: ScoringState): number => {
  const scoreA =
    score.flagsL2Defended * 2 +
    score.flagsL1Defended +
    score.flagsCenterDefended * 2;
  const scoreB = Math.min(10, score.flagsCenterShot + score.flagsOtherShot);
  const scoreC = score.goldenFlagsBonus * 5;
  const scoreD = getParkingPoints(score.robotParking);
  const penalty = score.bulletsInEnemyZone;
  return Math.max(0, scoreA + scoreB + scoreC + scoreD - penalty);
};
