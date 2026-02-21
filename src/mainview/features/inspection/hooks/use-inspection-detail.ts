import { useCallback, useEffect, useState } from "react";
import type {
  InspectionDetailResponse,
  InspectionHistoryEntry,
} from "../../../shared/types/inspection";
import {
  fetchInspectionDetail,
  fetchInspectionHistory,
  patchInspectionItems,
  patchInspectionStatus,
  postInspectionComment,
} from "../services/inspection-service";

interface UseInspectionDetailResult {
  data: InspectionDetailResponse | null;
  error: string | null;
  history: InspectionHistoryEntry[];
  isHistoryLoading: boolean;
  isLoading: boolean;
  isSaving: boolean;
  refreshDetail: () => void;
  saveComment: (comment: string) => Promise<void>;
  statusError: string | null;
  updateItem: (key: string, value: string | null) => Promise<void>;
  updateStatus: (status: string) => Promise<void>;
}

export const useInspectionDetail = (
  eventCode: string,
  teamNumber: number,
  token: string | null
): UseInspectionDetailResult => {
  const [data, setData] = useState<InspectionDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [history, setHistory] = useState<InspectionHistoryEntry[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

  const refreshDetail = useCallback((): void => {
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

    fetchInspectionDetail(eventCode, teamNumber, token)
      .then((result) => {
        if (!isCancelled) {
          setData(result);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load inspection."
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
  }, [eventCode, teamNumber, token, refreshTick]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshTick is an intentional re-fetch trigger
  useEffect(() => {
    if (!token) {
      setIsHistoryLoading(false);
      return;
    }

    let isCancelled = false;
    setIsHistoryLoading(true);

    fetchInspectionHistory(eventCode, teamNumber, token)
      .then((result) => {
        if (!isCancelled) {
          setHistory(result.history);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setHistory([]);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsHistoryLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [eventCode, teamNumber, token, refreshTick]);

  const updateItem = useCallback(
    async (key: string, value: string | null): Promise<void> => {
      if (!token) {
        return;
      }
      setIsSaving(true);
      setStatusError(null);
      try {
        const result = await patchInspectionItems(
          eventCode,
          teamNumber,
          [{ key, value }],
          token
        );
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save item.");
      } finally {
        setIsSaving(false);
      }
    },
    [eventCode, teamNumber, token]
  );

  const updateStatus = useCallback(
    async (status: string): Promise<void> => {
      if (!token) {
        return;
      }
      setIsSaving(true);
      setStatusError(null);
      try {
        const result = await patchInspectionStatus(
          eventCode,
          teamNumber,
          status,
          token
        );
        setData(result);
      } catch (err) {
        setStatusError(
          err instanceof Error ? err.message : "Failed to update status."
        );
      } finally {
        setIsSaving(false);
      }
    },
    [eventCode, teamNumber, token]
  );

  const saveComment = useCallback(
    async (comment: string): Promise<void> => {
      if (!token) {
        return;
      }
      setIsSaving(true);
      try {
        await postInspectionComment(eventCode, teamNumber, comment, token);
        refreshDetail();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to save comment."
        );
      } finally {
        setIsSaving(false);
      }
    },
    [eventCode, teamNumber, token, refreshDetail]
  );

  return {
    data,
    error,
    history,
    isHistoryLoading,
    isLoading,
    isSaving,
    refreshDetail,
    saveComment,
    statusError,
    updateItem,
    updateStatus,
  };
};
