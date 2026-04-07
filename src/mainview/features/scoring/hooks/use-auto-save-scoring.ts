import { useCallback, useEffect, useRef, useState } from "react";
import {
  saveMatchAllianceScore,
  scoringStateToApiBody,
} from "@/shared/api/scoring";
import type { MatchType } from "@/shared/types/scoring";
import type { ScoringState } from "../components/scoring-entry-form";

const DEBOUNCE_MS = 300;

interface UseAutoSaveScoringOptions {
  alliance: "red" | "blue";
  eventCode: string;
  matchNumber: number;
  matchType: MatchType;
  token: string | null;
}

export const useAutoSaveScoring = ({
  alliance,
  eventCode,
  matchNumber,
  matchType,
  token,
}: UseAutoSaveScoringOptions) => {
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaveError, setLastSaveError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>("");

  const saveScore = useCallback(
    async (score: ScoringState) => {
      if (!token) {
        return;
      }
      const body = scoringStateToApiBody(
        score,
        alliance,
        matchNumber,
        matchType
      );
      const key = JSON.stringify(body);
      if (key === lastSavedRef.current) {
        return;
      }
      setLastSaveError(null);
      try {
        await saveMatchAllianceScore(eventCode, body, token);
        lastSavedRef.current = key;
      } catch (err) {
        setLastSaveError(
          err instanceof Error ? err.message : "Failed to save score"
        );
      } finally {
        setIsAutoSaving(false);
        setIsSubmitting(false);
      }
    },
    [alliance, eventCode, matchNumber, matchType, token]
  );

  const onScoreChange = useCallback(
    (score: ScoringState) => {
      if (!token) {
        return;
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      setIsAutoSaving(true);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        saveScore(score);
      }, DEBOUNCE_MS);
    },
    [token, saveScore]
  );

  const submitScore = useCallback(
    async (score: ScoringState) => {
      if (!token) {
        return;
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      setIsSubmitting(true);
      setLastSaveError(null);
      await saveScore(score);
      setSubmitted(true);
    },
    [token, saveScore]
  );

  useEffect(
    () => () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    },
    []
  );

  return {
    isAutoSaving,
    isSubmitting,
    lastSaveError,
    onScoreChange,
    submitted,
    submitScore,
  };
};
