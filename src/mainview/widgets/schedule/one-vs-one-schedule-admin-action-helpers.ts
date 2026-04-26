import type { RefObject } from "react";
import type { ScheduleMessageSetter } from "./one-vs-one-schedule-admin-types";
import { type OneVsOneCsvMatch, parseMatchesFromCsvText } from "./schedule-csv";

export const wrapAsyncScheduleAction =
  (action: () => Promise<void>): (() => void) =>
  () => {
    action().catch(() => undefined);
  };

export const createOneVsOneCsvImportClickHandler = <TTiming, TResult>({
  fileInputRef,
  missingTokenMessage,
  onImportedScheduleSaved,
  resolveTiming,
  saveImportedSchedule,
  setErrorMessage,
  setIsImporting,
  setSuccessMessage,
  successMessage,
  token,
}: {
  fileInputRef: RefObject<HTMLInputElement>;
  missingTokenMessage: string;
  onImportedScheduleSaved: (result: TResult) => void;
  resolveTiming: () => TTiming | null;
  saveImportedSchedule: (
    matches: OneVsOneCsvMatch[],
    timing: TTiming,
    token: string
  ) => Promise<TResult>;
  setErrorMessage: ScheduleMessageSetter;
  setIsImporting: (isImporting: boolean) => void;
  setSuccessMessage: ScheduleMessageSetter;
  successMessage: (matches: OneVsOneCsvMatch[], result: TResult) => string;
  token: string | null;
}): (() => void) =>
  wrapAsyncScheduleAction(async () => {
    if (!token) {
      setErrorMessage(missingTokenMessage);
      return;
    }

    if (!fileInputRef.current?.files?.length) {
      setErrorMessage("No file selected.");
      return;
    }

    const timing = resolveTiming();
    if (!timing) {
      return;
    }

    const file = fileInputRef.current.files[0];
    const text = await file.text();

    setIsImporting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const importedMatches = parseMatchesFromCsvText(text);
      const result = await saveImportedSchedule(importedMatches, timing, token);
      onImportedScheduleSaved(result);
      setSuccessMessage(successMessage(importedMatches, result));
      fileInputRef.current.value = "";
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to import CSV."
      );
    } finally {
      setIsImporting(false);
    }
  });

export const createOneVsOneActivationClickHandler = <TResult>({
  hasMatches,
  isActive,
  missingMatchesMessage,
  missingTokenMessage,
  onActivationUpdated,
  setActivation,
  setErrorMessage,
  setIsUpdatingActivation,
  setSuccessMessage,
  successMessage,
  token,
}: {
  hasMatches: boolean;
  isActive: boolean;
  missingMatchesMessage: string;
  missingTokenMessage: string;
  onActivationUpdated: (result: TResult) => void;
  setActivation: (active: boolean, token: string) => Promise<TResult>;
  setErrorMessage: ScheduleMessageSetter;
  setIsUpdatingActivation: (isUpdatingActivation: boolean) => void;
  setSuccessMessage: ScheduleMessageSetter;
  successMessage: (result: TResult) => string;
  token: string | null;
}): (() => void) =>
  wrapAsyncScheduleAction(async () => {
    if (!token) {
      setErrorMessage(missingTokenMessage);
      return;
    }

    if (!(hasMatches || isActive)) {
      setErrorMessage(missingMatchesMessage);
      return;
    }

    setIsUpdatingActivation(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await setActivation(!isActive, token);
      onActivationUpdated(result);
      setSuccessMessage(successMessage(result));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to update schedule activation."
      );
    } finally {
      setIsUpdatingActivation(false);
    }
  });

export const createOneVsOneClearClickHandler = <TResult>({
  clearSchedule,
  fetchSchedule,
  failureMessage,
  missingTokenMessage,
  onScheduleCleared,
  setErrorMessage,
  setIsClearing,
  setSuccessMessage,
  successMessage,
  token,
}: {
  clearSchedule: (token: string) => Promise<void>;
  fetchSchedule: (token: string) => Promise<TResult>;
  failureMessage: string;
  missingTokenMessage: string;
  onScheduleCleared: (result: TResult) => void;
  setErrorMessage: ScheduleMessageSetter;
  setIsClearing: (isClearing: boolean) => void;
  setSuccessMessage: ScheduleMessageSetter;
  successMessage: string;
  token: string | null;
}): (() => void) =>
  wrapAsyncScheduleAction(async () => {
    if (!token) {
      setErrorMessage(missingTokenMessage);
      return;
    }

    setIsClearing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await clearSchedule(token);
      const refreshed = await fetchSchedule(token);
      onScheduleCleared(refreshed);
      setSuccessMessage(successMessage);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : failureMessage);
    } finally {
      setIsClearing(false);
    }
  });
