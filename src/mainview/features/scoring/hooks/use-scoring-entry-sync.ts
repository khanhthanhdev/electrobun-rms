import { useEffect, useMemo, useRef, useState } from "react";
import { scoresheetToScoringState } from "@/shared/api/scoring";
import type { MatchType } from "@/shared/types/scoring";
import type { ScoringState } from "../scoring-business-logic";
import { useAutoSaveScoring } from "./use-auto-save-scoring";
import { useMatchScoresheet } from "./use-match-results";

type Alliance = "red" | "blue";

interface UseScoringEntrySyncOptions {
  enabled?: boolean;
  eventCode: string;
  matchNumber: number;
  matchType: MatchType;
  token: string | null;
}

interface AllianceFormProps {
  initialScore?: Partial<ScoringState>;
  onChange: (score: ScoringState) => void;
  onSubmit: (score: ScoringState) => void;
}

export interface AllianceSaveState {
  isAutoSaving: boolean;
  isSubmitting: boolean;
  lastSaveError: string | null;
  submitted: boolean;
}

const toSaveState = (
  autoSave: ReturnType<typeof useAutoSaveScoring>
): AllianceSaveState => ({
  isAutoSaving: autoSave.isAutoSaving,
  isSubmitting: autoSave.isSubmitting,
  lastSaveError: autoSave.lastSaveError,
  submitted: autoSave.submitted,
});

export const useScoringEntrySync = ({
  enabled = true,
  eventCode,
  matchNumber,
  matchType,
  token,
}: UseScoringEntrySyncOptions) => {
  const scoresheetResult = useMatchScoresheet(
    eventCode,
    matchType,
    matchNumber,
    token,
    enabled
  );

  const redAutoSave = useAutoSaveScoring({
    alliance: "red",
    eventCode,
    matchNumber,
    matchType,
    token,
  });
  const blueAutoSave = useAutoSaveScoring({
    alliance: "blue",
    eventCode,
    matchNumber,
    matchType,
    token,
  });

  const remoteInitialScores = useMemo(
    () => ({
      blue: scoresheetResult.scoresheet?.blue
        ? scoresheetToScoringState(scoresheetResult.scoresheet.blue)
        : undefined,
      red: scoresheetResult.scoresheet?.red
        ? scoresheetToScoringState(scoresheetResult.scoresheet.red)
        : undefined,
    }),
    [scoresheetResult.scoresheet]
  );

  // Hold stable per-alliance initial scores. While an alliance has an
  // in-flight autosave or a debounced edit pending (`isAutoSaving` covers
  // both), refuse to publish a fresh remote scoresheet for that alliance —
  // doing so would race the user's newer local edits and silently overwrite
  // them when the server echoes back the older saved value via SSE refetch.
  // Once the save settles, the latest remote value flows through.
  const [stableInitialScores, setStableInitialScores] = useState<
    Record<Alliance, Partial<ScoringState> | undefined>
  >({ blue: undefined, red: undefined });
  const lastAppliedSignaturesRef = useRef<Record<Alliance, string | null>>({
    blue: null,
    red: null,
  });

  const redBusy = redAutoSave.isAutoSaving || redAutoSave.isSubmitting;
  const blueBusy = blueAutoSave.isAutoSaving || blueAutoSave.isSubmitting;

  useEffect(() => {
    setStableInitialScores((prev) => {
      let next = prev;

      const candidates: Array<{
        alliance: Alliance;
        busy: boolean;
        value: Partial<ScoringState> | undefined;
      }> = [
        { alliance: "red", busy: redBusy, value: remoteInitialScores.red },
        { alliance: "blue", busy: blueBusy, value: remoteInitialScores.blue },
      ];

      for (const { alliance, busy, value } of candidates) {
        if (busy) {
          continue;
        }
        const signature = value === undefined ? null : JSON.stringify(value);
        if (signature === lastAppliedSignaturesRef.current[alliance]) {
          continue;
        }
        lastAppliedSignaturesRef.current[alliance] = signature;
        if (next === prev) {
          next = { ...prev };
        }
        next[alliance] = value;
      }

      return next;
    });
  }, [remoteInitialScores.red, remoteInitialScores.blue, redBusy, blueBusy]);

  const formProps = useMemo(
    (): Record<Alliance, AllianceFormProps> => ({
      blue: {
        initialScore: stableInitialScores.blue,
        onChange: blueAutoSave.onScoreChange,
        onSubmit: blueAutoSave.submitScore,
      },
      red: {
        initialScore: stableInitialScores.red,
        onChange: redAutoSave.onScoreChange,
        onSubmit: redAutoSave.submitScore,
      },
    }),
    [
      blueAutoSave.onScoreChange,
      blueAutoSave.submitScore,
      redAutoSave.onScoreChange,
      redAutoSave.submitScore,
      stableInitialScores.blue,
      stableInitialScores.red,
    ]
  );

  return {
    ...scoresheetResult,
    formProps,
    saveState: {
      blue: toSaveState(blueAutoSave),
      red: toSaveState(redAutoSave),
    },
  };
};
