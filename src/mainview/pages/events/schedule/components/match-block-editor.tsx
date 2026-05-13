import type { MatchBlockState } from "@/widgets/schedule/schedule-utils";

interface MatchBlockEditorProps {
  defaultCycleTimeMinutes: number;
  matchBlocks: MatchBlockState[];
  mode?: "practice" | "qualification";
  onCycleTimeSecondsChange?: (seconds: number) => void;
  onMatchBlocksChange: (blocks: MatchBlockState[]) => void;
}

const buildFallbackBlock = (
  defaultCycleTimeMinutes: number
): MatchBlockState => ({
  id: "block-1",
  startTimeText: "08:00",
  endTimeText: "09:00",
  cycleTimeMinutes: defaultCycleTimeMinutes,
});

export const MatchBlockEditor = ({
  defaultCycleTimeMinutes,
  matchBlocks,
  mode = "practice",
  onCycleTimeSecondsChange,
  onMatchBlocksChange,
}: MatchBlockEditorProps): JSX.Element => {
  const isQualification = mode === "qualification";
  const block = matchBlocks[0] ?? buildFallbackBlock(defaultCycleTimeMinutes);

  const updatePrimaryBlock = (updates: Partial<MatchBlockState>): void => {
    const nextBlock = { ...block, ...updates };
    onMatchBlocksChange([nextBlock]);
  };

  return (
    <div className="schedule-timing-section">
      <div className="schedule-timing-fields">
        <label className="schedule-timing-field">
          <span>Start Time</span>
          <input
            onChange={(e) =>
              updatePrimaryBlock({ startTimeText: e.target.value })
            }
            type="time"
            value={block.startTimeText}
          />
        </label>

        {isQualification ? null : (
          <label className="schedule-timing-field">
            <span>End Time</span>
            <input
              onChange={(e) =>
                updatePrimaryBlock({ endTimeText: e.target.value })
              }
              type="time"
              value={block.endTimeText}
            />
          </label>
        )}

        <label className="schedule-timing-field">
          <span>Cycle Time (min)</span>
          <input
            min={1}
            onChange={(e) => {
              const cycleTimeMinutes = Math.max(
                1,
                Number.parseInt(e.target.value, 10) || 1
              );
              updatePrimaryBlock({ cycleTimeMinutes });
              onCycleTimeSecondsChange?.(cycleTimeMinutes * 60);
            }}
            type="number"
            value={block.cycleTimeMinutes}
          />
        </label>
      </div>
      <p className="schedule-timing-help">
        {isQualification
          ? "Qualification generation uses this start time and cycle time. It generates the required match count automatically."
          : "Practice generation uses this single timing window. Match count comes from the window length, field count, and cycle time."}
      </p>
    </div>
  );
};
