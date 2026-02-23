import {
  computeBlockCapacity,
  formatTimeForInput,
  type MatchBlockState,
} from "./schedule-utils";

interface MatchBlockEditorProps {
  defaultCycleTimeMinutes: number;
  matchBlocks: MatchBlockState[];
  onMatchBlocksChange: (blocks: MatchBlockState[]) => void;
  scheduleDate: string;
  teamCount: number;
}

export const MatchBlockEditor = ({
  matchBlocks,
  onMatchBlocksChange,
  scheduleDate,
  teamCount,
  defaultCycleTimeMinutes,
}: MatchBlockEditorProps): JSX.Element => {
  const cumulativeMatches = matchBlocks.reduce<number[]>((acc, block) => {
    const { matchesInBlock } = computeBlockCapacity(block, scheduleDate);
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

  return (
    <>
      <div className="stack" style={{ gap: "1rem" }}>
        {matchBlocks.map((block, index) => {
          const startDate = new Date(`${scheduleDate}T${block.startTimeText}`);
          const endDate = new Date(`${scheduleDate}T${block.endTimeText}`);
          const { matchesInBlock, durationMinutes } = computeBlockCapacity(
            block,
            scheduleDate
          );

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
                  min={0}
                  onChange={(e) => {
                    const desiredMatches = Math.max(
                      0,
                      Number.parseInt(e.target.value, 10) || 0
                    );
                    const dayEndMs = new Date(
                      `${scheduleDate}T23:59:59`
                    ).getTime();
                    const rawEndMs =
                      startDate.getTime() +
                      desiredMatches * block.cycleTimeMinutes * 60_000;
                    const newEndMs = Math.min(rawEndMs, dayEndMs);
                    const newEndDate = new Date(newEndMs);
                    const newEndText = `${String(newEndDate.getHours()).padStart(2, "0")}:${String(newEndDate.getMinutes()).padStart(2, "0")}`;
                    updateBlock(index, { endTimeText: newEndText });
                  }}
                  style={{ width: "50px" }}
                  type="number"
                  value={matchesInBlock}
                />{" "}
                Matches
              </div>
              <div style={{ marginBottom: "var(--space-2)" }}>
                {durationMinutes} minutes (Last match ends{" "}
                {durationMinutes - matchesInBlock * block.cycleTimeMinutes}{" "}
                minutes before end of block)
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
