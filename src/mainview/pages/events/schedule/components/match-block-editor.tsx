import { useState } from "react";
import {
  computeBlockCapacity,
  computeMinimumBlockDurationMinutesForMatchCount,
  formatTimeForInput,
  type MatchBlockState,
} from "@/widgets/schedule/schedule-utils";

interface MatchBlockEditorProps {
  defaultCycleTimeMinutes: number;
  fieldCount?: number;
  fieldStartOffsetSeconds?: number;
  matchBlocks: MatchBlockState[];
  onMatchBlocksChange: (blocks: MatchBlockState[]) => void;
  scheduleDate: string;
  teamCount: number;
}

const formatMinutesValue = (minutes: number): string =>
  Number.isInteger(minutes) ? minutes.toString() : minutes.toFixed(1);

const getRoundCountForMatches = (
  matchCount: number,
  fieldCount: number
): number => {
  if (matchCount <= 0) {
    return 0;
  }
  return Math.ceil(matchCount / Math.max(1, fieldCount));
};

export const MatchBlockEditor = ({
  matchBlocks,
  onMatchBlocksChange,
  scheduleDate,
  teamCount,
  defaultCycleTimeMinutes,
  fieldCount = 1,
  fieldStartOffsetSeconds = 0,
}: MatchBlockEditorProps): JSX.Element => {
  const safeFieldCount = Math.max(1, fieldCount);
  const [matchCountDraftByBlockId, setMatchCountDraftByBlockId] = useState<
    Record<string, string>
  >({});

  const cumulativeMatches = matchBlocks.reduce<number[]>((acc, block) => {
    const { matchesInBlock } = computeBlockCapacity(
      block,
      scheduleDate,
      safeFieldCount,
      fieldStartOffsetSeconds
    );
    const prev = acc.at(-1) ?? 0;
    acc.push(prev + matchesInBlock);
    return acc;
  }, []);

  const updateBlock = (index: number, updates: Partial<MatchBlockState>) => {
    onMatchBlocksChange(
      matchBlocks.map((b, i) => (i === index ? { ...b, ...updates } : b))
    );
  };

  const removeBlock = (index: number) => {
    onMatchBlocksChange(matchBlocks.filter((_, i) => i !== index));
  };

  const addBlock = () => {
    const lastBlock = matchBlocks.at(-1);
    let newStart = "09:00";
    if (lastBlock) {
      newStart = lastBlock.endTimeText;
    }
    const [h, m] = newStart.split(":").map(Number);
    const endH = String((h + 1) % 24).padStart(2, "0");
    const newEnd = `${endH}:${String(m).padStart(2, "0")}`;

    onMatchBlocksChange([
      ...matchBlocks,
      {
        id: `block-${Date.now()}`,
        startTimeText: newStart,
        endTimeText: newEnd,
        cycleTimeMinutes: defaultCycleTimeMinutes,
      },
    ]);
  };

  const clearMatchCountDraft = (blockId: string): void => {
    setMatchCountDraftByBlockId((previousDrafts) => {
      if (!(blockId in previousDrafts)) {
        return previousDrafts;
      }
      const nextDrafts = { ...previousDrafts };
      delete nextDrafts[blockId];
      return nextDrafts;
    });
  };

  const commitDesiredMatches = (
    block: MatchBlockState,
    index: number,
    startTimeMs: number,
    rawValue: string
  ): void => {
    if (!Number.isFinite(startTimeMs)) {
      return;
    }

    const desiredMatches = Math.max(0, Number.parseInt(rawValue, 10) || 0);
    const dayEndMs = new Date(`${scheduleDate}T23:59:59`).getTime();
    const minimumDurationMinutes =
      fieldStartOffsetSeconds > 0
        ? computeMinimumBlockDurationMinutesForMatchCount(
            desiredMatches,
            block.cycleTimeMinutes,
            safeFieldCount,
            fieldStartOffsetSeconds
          )
        : getRoundCountForMatches(desiredMatches, safeFieldCount) *
          block.cycleTimeMinutes;
    const rawEndMs = startTimeMs + minimumDurationMinutes * 60_000;
    const newEndMs = Math.min(rawEndMs, dayEndMs);
    const newEndDate = new Date(newEndMs);
    const newEndText = `${String(newEndDate.getHours()).padStart(2, "0")}:${String(newEndDate.getMinutes()).padStart(2, "0")}`;
    updateBlock(index, { endTimeText: newEndText });
  };

  return (
    <>
      <div className="stack" style={{ gap: "1rem" }}>
        {matchBlocks.map((block, index) => {
          const startDate = new Date(`${scheduleDate}T${block.startTimeText}`);
          const endDate = new Date(`${scheduleDate}T${block.endTimeText}`);
          const { matchesInBlock, durationMinutes } = computeBlockCapacity(
            block,
            scheduleDate,
            safeFieldCount,
            fieldStartOffsetSeconds
          );
          const minimumDurationMinutes =
            fieldStartOffsetSeconds > 0
              ? computeMinimumBlockDurationMinutesForMatchCount(
                  matchesInBlock,
                  block.cycleTimeMinutes,
                  safeFieldCount,
                  fieldStartOffsetSeconds
                )
              : getRoundCountForMatches(matchesInBlock, safeFieldCount) *
                block.cycleTimeMinutes;
          const roundSlackMinutes = durationMinutes - minimumDurationMinutes;
          const desiredMatchCountInputValue =
            matchCountDraftByBlockId[block.id] ?? matchesInBlock;

          const teamsPlayedSoFar =
            teamCount > 0
              ? Math.floor(cumulativeMatches[index] / teamCount)
              : 0;

          return (
            <div
              key={block.id}
              style={{
                border: "1px solid var(--border)",
                padding: "var(--space-3)",
                borderRadius: "var(--radius)",
              }}
            >
              <div
                style={{
                  fontWeight: "500",
                  fontSize: "1.2rem",
                  marginBottom: "var(--space-1)",
                }}
              >
                {formatTimeForInput(startDate.getTime() || 0)} -{" "}
                {formatTimeForInput(endDate.getTime() || 0)}:{" "}
                <input
                  aria-label={`Desired matches for block ${index + 1}`}
                  className="schedule-metric-input"
                  min={0}
                  onBlur={(e) => {
                    commitDesiredMatches(
                      block,
                      index,
                      startDate.getTime(),
                      e.target.value
                    );
                    clearMatchCountDraft(block.id);
                  }}
                  onChange={(e) => {
                    setMatchCountDraftByBlockId((previousDrafts) => ({
                      ...previousDrafts,
                      [block.id]: e.target.value,
                    }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") {
                      return;
                    }
                    e.preventDefault();
                    e.currentTarget.blur();
                  }}
                  step={1}
                  type="number"
                  value={desiredMatchCountInputValue}
                />{" "}
                Matches
              </div>
              <div style={{ marginBottom: "var(--space-2)" }}>
                {durationMinutes} minutes (Round slack:{" "}
                {formatMinutesValue(roundSlackMinutes)} min)
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "var(--space-3)",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-1)",
                  }}
                >
                  <span>Start</span>
                  <input
                    onChange={(e) =>
                      updateBlock(index, { startTimeText: e.target.value })
                    }
                    type="time"
                    value={block.startTimeText}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-1)",
                  }}
                >
                  <span>End</span>
                  <input
                    onChange={(e) =>
                      updateBlock(index, { endTimeText: e.target.value })
                    }
                    type="time"
                    value={block.endTimeText}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-1)",
                  }}
                >
                  <span>Cycle Time</span>
                  <input
                    min={1}
                    onChange={(e) =>
                      updateBlock(index, {
                        cycleTimeMinutes: Math.max(
                          1,
                          Number.parseInt(e.target.value, 10) || 1
                        ),
                      })
                    }
                    style={{ width: "60px" }}
                    type="number"
                    value={block.cycleTimeMinutes}
                  />
                </div>

                <button
                  onClick={() => removeBlock(index)}
                  style={{
                    marginLeft: "auto",
                    backgroundColor: "#6c757d",
                    color: "white",
                    border: "none",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                  type="button"
                >
                  Remove
                </button>
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  marginTop: "var(--space-2)",
                  color: "var(--muted-foreground)",
                }}
              >
                After this block, all teams will have played {teamsPlayedSoFar}{" "}
                match(es).
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: "var(--space-2)" }}>
        <button
          onClick={addBlock}
          style={{
            backgroundColor: "#6c757d",
            color: "white",
            border: "none",
          }}
          type="button"
        >
          Add Match Block
        </button>
      </div>
    </>
  );
};
