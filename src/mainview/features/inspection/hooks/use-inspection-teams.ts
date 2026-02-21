import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  InspectionStatus,
  InspectionTeamSummary,
  InspectionTeamsResponse,
} from "../../../shared/types/inspection";
import { fetchInspectionTeams } from "../services/inspection-service";

interface UseInspectionTeamsResult {
  error: string | null;
  isLoading: boolean;
  refreshTeams: () => void;
  search: string;
  setSearch: (value: string) => void;
  statusCounts: Record<InspectionStatus, number>;
  teams: InspectionTeamSummary[];
  totalTeams: number;
}

const EMPTY_STATUS_COUNTS: Record<InspectionStatus, number> = {
  NOT_STARTED: 0,
  IN_PROGRESS: 0,
  INCOMPLETE: 0,
  PASSED: 0,
};

export const useInspectionTeams = (
  eventCode: string,
  token: string | null
): UseInspectionTeamsResult => {
  const [data, setData] = useState<InspectionTeamsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [search, setSearch] = useState("");

  const refreshTeams = useCallback((): void => {
    setRefreshTick((t) => t + 1);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshTick is an intentional re-fetch trigger
  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    let isCancelled = false;
    setIsLoading(true);
    setError(null);

    fetchInspectionTeams(eventCode, token, "")
      .then((result) => {
        if (!isCancelled) {
          setData(result);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load inspection teams."
          );
          setData(null);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [eventCode, token, refreshTick]);

  const filteredTeams = useMemo(() => {
    if (!data) {
      return [];
    }
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return data.teams;
    }
    return data.teams.filter(
      (team) =>
        String(team.teamNumber).includes(normalizedSearch) ||
        (team.teamName?.toLowerCase().includes(normalizedSearch) ?? false)
    );
  }, [data, search]);

  return {
    error,
    isLoading,
    refreshTeams,
    search,
    setSearch,
    statusCounts: data?.statusCounts ?? EMPTY_STATUS_COUNTS,
    teams: filteredTeams,
    totalTeams: data?.totalTeams ?? 0,
  };
};
