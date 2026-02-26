import { useCallback, useEffect, useState } from "react";
import { fetchPracticeSchedule } from "../../../features/events/services/schedule/practice-schedule-service";
import { fetchQualificationSchedule } from "../../../features/events/services/schedule/qualification-schedule-service";
import type { OneVsOneScheduleMatch } from "../../../features/events/services/schedule/shared-schedule-types";
import { LoadingIndicator } from "../../../shared/components/loading-indicator";

interface MatchSelectionPageProps {
  eventCode: string;
  fieldNumber: string;
  onNavigate: (path: string) => void;
  role: "blue" | "hr" | "red";
  token: string | null;
}

interface ScheduleResponse {
  config?: { fieldCount?: number };
  matches?: OneVsOneScheduleMatch[];
}

interface MatchBlock {
  label: string;
  match: OneVsOneScheduleMatch;
  type: "practice" | "qual";
}

const collectMatchBlocks = (
  resp: ScheduleResponse | null,
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
      blocks.push({
        type,
        match: m,
        label: `${prefix} M${m.matchNumber}`,
      });
    }
  }

  return blocks;
};

const loadScheduleMatches = async (
  eventCode: string,
  token: string,
  fieldNumber: string
): Promise<MatchBlock[]> => {
  const [pracResp, qualResp] = await Promise.all<ScheduleResponse | null>([
    fetchPracticeSchedule(eventCode, token).catch(() => null),
    fetchQualificationSchedule(eventCode, token).catch(() => null),
  ]);

  const combined: MatchBlock[] = [
    ...collectMatchBlocks(pracResp, "practice", "Practice", fieldNumber),
    ...collectMatchBlocks(qualResp, "qual", "Match", fieldNumber),
  ];

  combined.sort((a, b) => a.match.startTime - b.match.startTime);

  return combined;
};

const useMatchSchedule = (
  eventCode: string,
  fieldNumber: string,
  token: string | null
): { matches: MatchBlock[]; isLoading: boolean; error: string | null } => {
  const [matches, setMatches] = useState<MatchBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onSuccess = useCallback((result: MatchBlock[]) => {
    setMatches(result);
    setIsLoading(false);
  }, []);

  const onError = useCallback((err: unknown) => {
    setError(err instanceof Error ? err.message : "Failed to load matches.");
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!token) {
      setError("User must be authenticated to load schedule.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    loadScheduleMatches(eventCode, token, fieldNumber)
      .then((result) => {
        if (!cancelled) {
          onSuccess(result);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          onError(err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [eventCode, fieldNumber, token, onSuccess, onError]);

  return { matches, isLoading, error };
};

export const MatchSelectionPage = ({
  eventCode,
  fieldNumber,
  onNavigate,
  role,
  token,
}: MatchSelectionPageProps): JSX.Element => {
  const { matches, isLoading, error } = useMatchSchedule(
    eventCode,
    fieldNumber,
    token
  );

  const roleStyles = {
    red: {
      headerBg: "#dc2626",
      headerColor: "white",
      title:
        fieldNumber === "all"
          ? "Match Selection (All Fields)"
          : `Match Selection (Field ${fieldNumber})`,
    },
    blue: {
      headerBg: "#0284c7",
      headerColor: "white",
      title:
        fieldNumber === "all"
          ? "Match Selection (All Fields)"
          : `Match Selection (Field ${fieldNumber})`,
    },
    hr: {
      headerBg: "#f97316",
      headerColor: "white",
      title:
        fieldNumber === "all"
          ? "Match Selection (All Fields)"
          : `Match Selection (Field ${fieldNumber})`,
    },
  };

  const config = roleStyles[role];

  // Back path goes to field selection for the role
  const selectionBackPath =
    role === "hr"
      ? `/event/${eventCode}/hr`
      : `/event/${eventCode}/ref/${role}/scoring`;

  if (isLoading) {
    return (
      <main className="page-shell page-shell--center">
        <LoadingIndicator />
      </main>
    );
  }

  return (
    <main
      style={{
        backgroundColor: "#f9fafb",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: "2rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: "800px", padding: "0 1rem" }}>
        {/* Header */}
        <div
          style={{
            backgroundColor: config.headerBg,
            color: config.headerColor,
            padding: "1rem",
            borderRadius: "0.25rem",
            marginBottom: "1.5rem",
          }}
        >
          <button
            onClick={() => onNavigate(selectionBackPath)}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              fontSize: "0.85rem",
              opacity: 0.9,
              padding: 0,
              display: "block",
              marginBottom: "0.4rem",
            }}
            type="button"
          >
            ← Back to Selection
          </button>
          <div
            style={{
              textAlign: "center",
              fontWeight: "600",
              fontSize: "1.125rem",
            }}
          >
            {config.title}
          </div>
        </div>

        {error ? (
          <div style={{ color: "red", marginBottom: "1rem" }}>{error}</div>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {matches.length === 0 && !error ? (
            <div style={{ textAlign: "center", color: "#6b7280" }}>
              No matches found for this selection.
            </div>
          ) : null}
          {matches.map((mb, idx) => (
            <button
              key={`${mb.type}-${mb.match.matchNumber}-${idx}`}
              onClick={() => {
                const matchPath =
                  role === "hr"
                    ? `/event/${eventCode}/hr/${fieldNumber}/match/${mb.match.matchNumber}`
                    : `/event/${eventCode}/ref/${role}/scoring/${fieldNumber}/match/${mb.match.matchNumber}`;
                onNavigate(matchPath);
              }}
              style={{
                width: "100%",
                padding: "0.875rem",
                backgroundColor: "white",
                border: "1px solid #3b82f6",
                borderRadius: "0.25rem",
                fontSize: "1rem",
                cursor: "pointer",
                display: "flex",
                justifyContent: "center",
                gap: "1.5rem",
                transition: "background-color 0.2s",
                color: "#3b82f6",
              }}
              type="button"
            >
              <span>{mb.label}</span>
              <span>Red Team: {mb.match.redTeam}</span>
              <span>Blue Team: {mb.match.blueTeam}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
};
