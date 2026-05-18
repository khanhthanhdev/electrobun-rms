import type { DisplayMatchRef } from "@shared/display";
import type { MatchControlState } from "@shared/match-control";
import { MATCH_DURATION_SECONDS } from "@shared/match-control";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchMatchControlState,
  getMatchControlRealtimeState,
  MatchControlTransitionError,
  postMatchControlClearScores,
  postMatchControlLoad,
  postMatchControlShowResults,
  postMatchControlTransition,
  subscribeToMatchControlRealtimeState,
  useMatchControlData,
} from "@/features/events/control";
import { useMatchControlRealtime } from "@/features/events/control/hooks/use-match-control-realtime";
import {
  computeTimeRemaining,
  type MatchRef,
  matchRefEquals,
  resolveMatchRow,
  toMatchRef,
} from "@/features/events/control/match-control-session";
import { useScoringRealtime } from "@/features/scoring/hooks/use-scoring-realtime";
import { LoadingIndicator } from "../../../shared/components/loading-indicator";
import type {
  ControlMatchRow,
  ControlMatchType,
} from "../../../shared/types/match-control";
import { ControlActiveMatchPanel } from "./control-active-match-panel";
import { ControlScheduleTable } from "./control-schedule-table";
import { MatchControlSettingsPanel } from "./match-control-settings-panel";

interface EventControlPageProps {
  eventCode: string;
  onNavigate: (path: string) => void;
  token: string | null;
}

type ControlTab =
  | "active"
  | "incomplete"
  | "schedule"
  | "score-edit"
  | "settings";

type LoadedMatchState = "idle" | "loaded" | "preview" | "ready";
type ActiveMatchState = "idle" | "in_progress" | "paused" | "completed";

const MATCH_TYPE_LABELS: Record<ControlMatchType, string> = {
  practice: "Practice",
  quals: "Qualification",
};

const CONTROL_TABS: Array<{ id: ControlTab; label: string }> = [
  { id: "schedule", label: "Schedule" },
  { id: "incomplete", label: "Incomplete Matches" },
  { id: "score-edit", label: "Score Edit" },
  { id: "active", label: "Active Match" },
  { id: "settings", label: "Settings" },
];

const LOADED_STATE_LABELS: Record<LoadedMatchState, string> = {
  idle: "",
  loaded: "Not Started",
  preview: "Preview",
  ready: "Ready",
};

const LOADED_STATE_CSS: Record<LoadedMatchState, string> = {
  idle: "",
  loaded: "match-control-status-badge--loaded",
  preview: "match-control-status-badge--preview",
  ready: "match-control-status-badge--ready",
};

const ACTIVE_STATE_LABELS: Record<ActiveMatchState, string> = {
  idle: "",
  in_progress: "In Progress",
  paused: "Paused",
  completed: "Complete",
};

const ACTIVE_STATE_CSS: Record<ActiveMatchState, string> = {
  idle: "",
  in_progress: "match-control-status-badge--in-progress",
  paused: "match-control-status-badge--ready",
  completed: "match-control-status-badge--completed",
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const toDisplayMatchRef = (match: ControlMatchRow): DisplayMatchRef => ({
  blueTeam: match.blueTeam,
  blueTeamName: match.blueTeamName,
  fieldNumber: match.fieldNumber,
  matchName: match.matchName,
  matchNumber: match.matchNumber,
  matchType: match.matchType,
  redTeam: match.redTeam,
  redTeamName: match.redTeamName,
});

const shouldClearScoresBeforeLoad = (row: ControlMatchRow): boolean =>
  row.state === "INCOMPLETE" || row.state === "COMMITTED";

const StatusBar = ({
  activeMatch,
  activeState,
  loadedMatch,
  loadedState,
  timeRemaining,
}: {
  activeMatch: ControlMatchRow | null;
  activeState: ActiveMatchState;
  loadedMatch: ControlMatchRow | null;
  loadedState: LoadedMatchState;
  timeRemaining: number;
}): JSX.Element => (
  <div className="match-control-status-bar">
    <div className="match-control-status-row">
      <span className="match-control-status-label">Loaded Match:</span>
      {loadedMatch ? (
        <>
          <span className="match-control-status-name">
            {loadedMatch.matchName}
          </span>
          <span className="match-control-status-time">
            {formatTime(MATCH_DURATION_SECONDS)}
          </span>
          <span
            className={`match-control-status-badge ${LOADED_STATE_CSS[loadedState]}`}
          >
            {LOADED_STATE_LABELS[loadedState]}
          </span>
          <span className="match-control-status-teams">
            <span className="match-control-red-team">
              Red: {loadedMatch.redTeam}
            </span>
            <span className="match-control-blue-team">
              Blue: {loadedMatch.blueTeam}
            </span>
          </span>
        </>
      ) : (
        <span className="match-control-status-empty">No match loaded</span>
      )}
    </div>
    <div className="match-control-status-row">
      <span className="match-control-status-label">Active Match:</span>
      {activeMatch ? (
        <>
          <span className="match-control-status-name">
            {activeMatch.matchName}
          </span>
          <span className="match-control-status-time">
            {formatTime(timeRemaining)}
          </span>
          <span
            className={`match-control-status-badge ${ACTIVE_STATE_CSS[activeState]}`}
          >
            {ACTIVE_STATE_LABELS[activeState]}
          </span>
          <span className="match-control-status-teams">
            <span className="match-control-red-team">
              Red: {activeMatch.redTeam}
            </span>
            <span className="match-control-blue-team">
              Blue: {activeMatch.blueTeam}
            </span>
          </span>
        </>
      ) : (
        <span className="match-control-status-empty">—</span>
      )}
    </div>
  </div>
);

const ActionBar = ({
  activeState,
  canLoadNext,
  loadedState,
  onAbort,
  onCommit,
  onLoadNext,
  onPause,
  onResume,
  onShowMatch,
  onShowPreview,
  onStartMatch,
  onUnload,
}: {
  activeState: ActiveMatchState;
  canLoadNext: boolean;
  loadedState: LoadedMatchState;
  onAbort: () => void;
  onCommit: () => void;
  onLoadNext: () => void;
  onPause: () => void;
  onResume: () => void;
  onShowMatch: () => void;
  onShowPreview: () => void;
  onStartMatch: () => void;
  onUnload: () => void;
}): JSX.Element => {
  const [showAbortDialog, setShowAbortDialog] = useState(false);
  const isInProgress = activeState === "in_progress";
  const isPaused = activeState === "paused";
  const canLoadNextAction = canLoadNext && activeState === "idle";
  const canUnload = loadedState !== "idle" && activeState === "idle";
  const canPreview = loadedState === "loaded";
  const canShowMatch = loadedState === "preview";
  const canStart = loadedState === "ready" && activeState === "idle";
  const highlightShowPreview = loadedState === "loaded";
  const highlightShowMatch = loadedState === "preview";

  return (
    <>
      <div className="match-control-action-bar">
        <div className="match-control-action-row">
          <button
            className="button"
            disabled={!canLoadNextAction}
            onClick={onLoadNext}
            type="button"
          >
            Load Next Match
          </button>
          <button
            className="button"
            disabled={!canUnload}
            onClick={onUnload}
            type="button"
          >
            Unload
          </button>
          <button
            className={`button ${highlightShowPreview ? "match-control-action-btn--highlight" : ""}`}
            disabled={!canPreview}
            onClick={onShowPreview}
            type="button"
          >
            Show Preview
          </button>
          <button
            className={`button ${highlightShowMatch ? "match-control-action-btn--highlight" : ""}`}
            disabled={!canShowMatch}
            onClick={onShowMatch}
            type="button"
          >
            Show Match
          </button>
          {isInProgress || isPaused ? (
            <>
              <button
                className="button"
                onClick={isPaused ? onResume : onPause}
                type="button"
              >
                {isPaused ? "Resume" : "Pause"}
              </button>
              <button
                className="button match-control-action-btn--abort"
                onClick={() => setShowAbortDialog(true)}
                type="button"
              >
                Abort Match
              </button>
            </>
          ) : (
            <button
              className={`button ${canStart ? "match-control-action-btn--start" : ""}`}
              disabled={!canStart}
              onClick={onStartMatch}
              type="button"
            >
              Start Match
            </button>
          )}
          <button
            className={`button ${activeState === "completed" ? "match-control-action-btn--commit" : ""}`}
            disabled={activeState !== "completed"}
            onClick={onCommit}
            style={{ marginLeft: "auto" }}
            type="button"
          >
            Commit Score
          </button>
        </div>
      </div>

      {showAbortDialog ? (
        <div className="match-control-dialog-overlay">
          <div className="match-control-dialog">
            <div className="match-control-dialog-header">
              <h3 className="match-control-dialog-title">Abort Match?</h3>
              <button
                className="match-control-dialog-close"
                onClick={() => setShowAbortDialog(false)}
                type="button"
              >
                ×
              </button>
            </div>
            <p className="match-control-dialog-body">
              This will reset the current match and discard all scores.
            </p>
            <div className="match-control-dialog-actions">
              <button
                className="match-control-dialog-btn-secondary"
                onClick={() => setShowAbortDialog(false)}
                type="button"
              >
                Close
              </button>
              <button
                className="match-control-dialog-btn-primary"
                onClick={() => {
                  setShowAbortDialog(false);
                  onAbort();
                }}
                type="button"
              >
                Abort
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

const ScoreEditPanel = ({
  eventCode,
  onNavigate,
  rows,
}: {
  eventCode: string;
  onNavigate: (path: string) => void;
  rows: ControlMatchRow[];
}): JSX.Element => {
  const committedRows = rows.filter((row) => row.state === "COMMITTED");
  const [editMatchNumber, setEditMatchNumber] = useState<number | null>(
    committedRows[0]?.matchNumber ?? null
  );

  const editMatch = committedRows.find(
    (row) => row.matchNumber === editMatchNumber
  );

  return (
    <div className="match-control-score-edit-panel">
      {committedRows.length === 0 ? (
        <p className="empty-state">No committed matches available to edit.</p>
      ) : (
        <>
          <label className="match-control-score-edit-select">
            Select Match
            <select
              onChange={(e) =>
                setEditMatchNumber(Number.parseInt(e.target.value, 10))
              }
              value={editMatchNumber ?? ""}
            >
              {committedRows.map((row) => (
                <option key={row.matchName} value={row.matchNumber}>
                  {row.matchName} — Red {row.redScore} · Blue {row.blueScore}
                </option>
              ))}
            </select>
          </label>

          {editMatch ? (
            <div className="match-control-active-scores">
              <div className="match-control-active-alliance match-control-red-team">
                <p>
                  Red #{editMatch.redTeam} {editMatch.redTeamName}
                </p>
                <strong>{editMatch.redScore ?? "-"}</strong>
              </div>
              <div className="match-control-active-alliance match-control-blue-team">
                <p>
                  Blue #{editMatch.blueTeam} {editMatch.blueTeamName}
                </p>
                <strong>{editMatch.blueScore ?? "-"}</strong>
              </div>
            </div>
          ) : null}

          {editMatch ? (
            <div className="match-control-active-links">
              <a
                href={`/event/${eventCode}/match/${editMatch.matchName}`}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(
                    `/event/${eventCode}/match/${editMatch.matchName}`
                  );
                }}
              >
                Open Scoresheet
              </a>
              <a
                href={`/event/${eventCode}/ref/red/scoring/${editMatch.fieldNumber}/${editMatch.matchType}/match/${editMatch.matchNumber}`}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(
                    `/event/${eventCode}/ref/red/scoring/${editMatch.fieldNumber}/${editMatch.matchType}/match/${editMatch.matchNumber}`
                  );
                }}
              >
                Edit Red Scores
              </a>
              <a
                href={`/event/${eventCode}/ref/blue/scoring/${editMatch.fieldNumber}/${editMatch.matchType}/match/${editMatch.matchNumber}`}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(
                    `/event/${eventCode}/ref/blue/scoring/${editMatch.fieldNumber}/${editMatch.matchType}/match/${editMatch.matchNumber}`
                  );
                }}
              >
                Edit Blue Scores
              </a>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};

export const EventControlPage = ({
  eventCode,
  onNavigate,
  token,
}: EventControlPageProps): JSX.Element => {
  const { data, error, isLoading, refresh } = useMatchControlData(
    eventCode,
    token
  );
  useScoringRealtime(eventCode, token);
  useMatchControlRealtime(eventCode, token);
  const [selectedTab, setSelectedTab] = useState<ControlTab>("schedule");
  const [selectedMatchType, setSelectedMatchType] =
    useState<ControlMatchType>("practice");
  const [resetScoreRow, setResetScoreRow] = useState<ControlMatchRow | null>(
    null
  );
  const [replayLoadRow, setReplayLoadRow] = useState<ControlMatchRow | null>(
    null
  );
  const [isScoreClearSubmitting, setIsScoreClearSubmitting] = useState(false);
  const [isReplayLoadSubmitting, setIsReplayLoadSubmitting] = useState(false);

  // ---------------------------------------------------------------------------
  // Server-derived match lifecycle state
  // ---------------------------------------------------------------------------
  const [serverState, setServerState] = useState<MatchControlState | null>(
    null
  );
  const versionRef = useRef(0);

  const applyServerState = useCallback((state: MatchControlState) => {
    if (state.version < versionRef.current) {
      return;
    }
    versionRef.current = state.version;
    setServerState(state);
  }, []);

  // ---------------------------------------------------------------------------
  // Transition error handling
  // ---------------------------------------------------------------------------
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const transitionErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const showTransitionError = useCallback((message: string) => {
    if (transitionErrorTimerRef.current) {
      clearTimeout(transitionErrorTimerRef.current);
    }
    setTransitionError(message);
    transitionErrorTimerRef.current = setTimeout(() => {
      setTransitionError(null);
      transitionErrorTimerRef.current = null;
    }, 5000);
  }, []);

  const handleTransitionError = useCallback(
    (err: unknown) => {
      if (err instanceof MatchControlTransitionError) {
        if (err.body.error === "STATE_CONFLICT" && err.body.currentState) {
          applyServerState(err.body.currentState);
          showTransitionError(
            "State was out of sync — refreshed. Please retry."
          );
        } else {
          showTransitionError(err.body.message);
        }
      } else if (err instanceof Error) {
        showTransitionError(err.message);
      } else {
        showTransitionError("An unexpected error occurred.");
      }
    },
    [applyServerState, showTransitionError]
  );

  useEffect(() => {
    return () => {
      if (transitionErrorTimerRef.current) {
        clearTimeout(transitionErrorTimerRef.current);
      }
    };
  }, []);

  // Initial hydration from server
  useEffect(() => {
    if (!token) {
      return;
    }
    fetchMatchControlState(eventCode, token)
      .then((res) => {
        applyServerState(res.state);
      })
      .catch(() => {
        // Keep the page interactive even if the initial state fetch fails.
      });
  }, [eventCode, token, applyServerState]);

  // Subscribe to SSE state updates via the sync store
  useEffect(() => {
    const syncFromStore = (): void => {
      const storeState = getMatchControlRealtimeState(eventCode);
      if (storeState) {
        applyServerState(storeState);
      }
    };
    // Apply any state already in store
    syncFromStore();
    return subscribeToMatchControlRealtimeState(eventCode, syncFromStore);
  }, [eventCode, applyServerState]);

  // Derive UI values from server state
  const loadedState: LoadedMatchState = serverState
    ? (serverState.loadedState.toLowerCase() as LoadedMatchState)
    : "idle";
  const activeState: ActiveMatchState = serverState
    ? (serverState.activeState.toLowerCase() as ActiveMatchState)
    : "idle";
  const activeStartedAtMs = serverState?.activeStartedAtMs ?? null;
  const activePausedRemainingMs = serverState?.activePausedRemainingMs ?? null;

  // Convert server DisplayMatchRef → MatchRef for row resolution
  const loadedMatchRef = useMemo<MatchRef | null>(() => {
    if (!serverState?.loadedMatch) {
      return null;
    }
    return {
      matchNumber: serverState.loadedMatch.matchNumber,
      matchType: serverState.loadedMatch.matchType as ControlMatchType,
    };
  }, [serverState]);

  const activeMatchRef = useMemo<MatchRef | null>(() => {
    if (!serverState?.activeMatch) {
      return null;
    }
    return {
      matchNumber: serverState.activeMatch.matchNumber,
      matchType: serverState.activeMatch.matchType as ControlMatchType,
    };
  }, [serverState]);

  // Timer — local countdown for display only; completion comes from server
  const [timeRemaining, setTimeRemaining] = useState(MATCH_DURATION_SECONDS);

  useEffect(() => {
    if (activeState === "paused" && activePausedRemainingMs !== null) {
      setTimeRemaining(Math.ceil(activePausedRemainingMs / 1000));
    } else if (activeState === "in_progress" && activeStartedAtMs) {
      setTimeRemaining(
        computeTimeRemaining(activeStartedAtMs, MATCH_DURATION_SECONDS)
      );
    } else if (activeState === "idle") {
      setTimeRemaining(MATCH_DURATION_SECONDS);
    }
  }, [activeState, activeStartedAtMs, activePausedRemainingMs]);

  useEffect(() => {
    if (activeState !== "in_progress" || timeRemaining <= 0) {
      return;
    }
    const id = setInterval(() => {
      setTimeRemaining((t) => (t <= 1 ? 0 : t - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [activeState, timeRemaining]);

  useEffect(() => {
    if (!data) {
      return;
    }
    const preferredMatchType =
      data.activeScheduleType ?? data.availableMatchTypes[0];
    if (preferredMatchType) {
      setSelectedMatchType(preferredMatchType);
    }
  }, [data]);

  const selectedRows = useMemo<ControlMatchRow[]>(() => {
    if (!data) {
      return [];
    }
    return data.byType[selectedMatchType] ?? [];
  }, [data, selectedMatchType]);

  const incompleteRows = useMemo(
    () => selectedRows.filter((row) => row.state !== "COMMITTED"),
    [selectedRows]
  );

  const loadedMatch = useMemo(
    () => resolveMatchRow(data, loadedMatchRef),
    [data, loadedMatchRef]
  );

  const activeMatch = useMemo(
    () => resolveMatchRow(data, activeMatchRef),
    [data, activeMatchRef]
  );
  const selectedTableMatch = activeMatchRef ?? loadedMatchRef;
  const nextLoadableMatch = useMemo(
    () =>
      selectedRows.find((row) => {
        // Treat INCOMPLETE the same as UNPLAYED for "next loadable" — both
        // have not been committed yet and need to be played.
        if (row.state !== "UNPLAYED" && row.state !== "INCOMPLETE") {
          return false;
        }
        const ref = toMatchRef(row);
        if (activeMatchRef && matchRefEquals(ref, activeMatchRef)) {
          return false;
        }
        if (loadedMatchRef && matchRefEquals(ref, loadedMatchRef)) {
          return false;
        }
        return true;
      }) ?? null,
    [selectedRows, activeMatchRef, loadedMatchRef]
  );
  const canLoadNext =
    Boolean(token) &&
    Boolean(data) &&
    !isLoading &&
    !error &&
    nextLoadableMatch !== null;

  // ---------------------------------------------------------------------------
  // Action handlers — POST to server, state comes back via SSE
  // ---------------------------------------------------------------------------

  const loadMatchRow = useCallback(
    async (row: ControlMatchRow, resetScoresBeforeLoad: boolean) => {
      if (!token) {
        return;
      }

      if (loadedMatchRef) {
        const unload = await postMatchControlTransition(
          eventCode,
          token,
          "unload",
          versionRef.current
        );
        applyServerState(unload.state);
      }

      const load = await postMatchControlLoad(
        eventCode,
        token,
        toDisplayMatchRef(row),
        versionRef.current,
        { resetScoresBeforeLoad }
      );
      applyServerState(load.state);
    },
    [eventCode, token, loadedMatchRef, applyServerState]
  );

  const handleLoadNextMatch = useCallback(() => {
    if (!(token && nextLoadableMatch)) {
      return;
    }
    if (shouldClearScoresBeforeLoad(nextLoadableMatch)) {
      setReplayLoadRow(nextLoadableMatch);
      return;
    }
    loadMatchRow(nextLoadableMatch, false).catch(handleTransitionError);
  }, [
    nextLoadableMatch,
    token,
    loadMatchRow,
    handleTransitionError,
  ]);

  const handleLoadMatch = useCallback(
    (matchNumber: number) => {
      if (!token) {
        return;
      }
      const row = selectedRows.find((r) => r.matchNumber === matchNumber);
      if (!row) {
        return;
      }
      const ref: MatchRef = { matchNumber, matchType: selectedMatchType };
      if (matchRefEquals(ref, activeMatchRef)) {
        return;
      }
      if (shouldClearScoresBeforeLoad(row)) {
        setReplayLoadRow(row);
        return;
      }
      loadMatchRow(row, false).catch(handleTransitionError);
    },
    [
      activeMatchRef,
      selectedMatchType,
      selectedRows,
      token,
      loadMatchRow,
      handleTransitionError,
    ]
  );

  // Display commands are published server-side via the match-control bridge
  // (display-match-control-bridge.ts). Do not duplicate them here.

  const handleShowPreview = useCallback(() => {
    if (!token) {
      return;
    }
    postMatchControlTransition(
      eventCode,
      token,
      "show-preview",
      versionRef.current
    )
      .then((res) => applyServerState(res.state))
      .catch(handleTransitionError);
  }, [eventCode, token, applyServerState, handleTransitionError]);

  const handleUnloadMatch = useCallback(() => {
    if (!token) {
      return;
    }
    postMatchControlTransition(eventCode, token, "unload", versionRef.current)
      .then((res) => applyServerState(res.state))
      .catch(handleTransitionError);
  }, [eventCode, token, applyServerState, handleTransitionError]);

  const handleShowMatch = useCallback(() => {
    if (!token) {
      return;
    }
    postMatchControlTransition(
      eventCode,
      token,
      "show-match",
      versionRef.current
    )
      .then((res) => applyServerState(res.state))
      .catch(handleTransitionError);
  }, [eventCode, token, applyServerState, handleTransitionError]);

  const handleStartMatch = useCallback(() => {
    if (!token) {
      return;
    }
    postMatchControlTransition(eventCode, token, "start", versionRef.current)
      .then((res) => {
        applyServerState(res.state);
        setSelectedTab("active");
      })
      .catch(handleTransitionError);
  }, [eventCode, token, applyServerState, handleTransitionError]);

  const handlePauseMatch = useCallback(() => {
    if (!token) {
      return;
    }
    postMatchControlTransition(eventCode, token, "pause", versionRef.current)
      .then((res) => applyServerState(res.state))
      .catch(handleTransitionError);
  }, [eventCode, token, applyServerState, handleTransitionError]);

  const handleResumeMatch = useCallback(() => {
    if (!token) {
      return;
    }
    postMatchControlTransition(eventCode, token, "resume", versionRef.current)
      .then((res) => applyServerState(res.state))
      .catch(handleTransitionError);
  }, [eventCode, token, applyServerState, handleTransitionError]);

  const handleAbortMatch = useCallback(() => {
    if (!token) {
      return;
    }
    postMatchControlTransition(eventCode, token, "abort", versionRef.current)
      .then((res) => {
        applyServerState(res.state);
        setSelectedTab("schedule");
        refresh();
      })
      .catch(handleTransitionError);
  }, [eventCode, token, applyServerState, refresh, handleTransitionError]);

  const handleResetScore = useCallback(
    (row: ControlMatchRow) => {
      if (!token) {
        return;
      }
      // Defensive UI guard — also enforced by the server.
      const ref: MatchRef = {
        matchNumber: row.matchNumber,
        matchType: row.matchType,
      };
      if (
        matchRefEquals(ref, activeMatchRef) ||
        matchRefEquals(ref, loadedMatchRef)
      ) {
        showTransitionError(
          "Cannot reset scores for the loaded or active match. Unload or abort first."
        );
        return;
      }
      setResetScoreRow(row);
    },
    [token, activeMatchRef, loadedMatchRef, showTransitionError]
  );

  const confirmResetScore = useCallback(() => {
    if (!(token && resetScoreRow) || isScoreClearSubmitting) {
      return;
    }
    const row = resetScoreRow;
    setIsScoreClearSubmitting(true);
    postMatchControlClearScores(
      eventCode,
      token,
      row.matchType,
      row.matchNumber
    )
      .then((res) => {
        applyServerState(res.state);
        setResetScoreRow(null);
        refresh();
      })
      .catch(handleTransitionError)
      .finally(() => setIsScoreClearSubmitting(false));
  }, [
    eventCode,
    token,
    resetScoreRow,
    isScoreClearSubmitting,
    refresh,
    applyServerState,
    handleTransitionError,
  ]);

  const confirmReplayLoad = useCallback(() => {
    if (!replayLoadRow || isReplayLoadSubmitting) {
      return;
    }
    const row = replayLoadRow;
    setIsReplayLoadSubmitting(true);
    loadMatchRow(row, true)
      .then(() => setReplayLoadRow(null))
      .catch(handleTransitionError)
      .finally(() => setIsReplayLoadSubmitting(false));
  }, [
    replayLoadRow,
    isReplayLoadSubmitting,
    loadMatchRow,
    handleTransitionError,
  ]);

  const handleCommitMatch = useCallback(() => {
    if (!token) {
      return;
    }
    postMatchControlTransition(eventCode, token, "commit", versionRef.current)
      .then((res) => {
        applyServerState(res.state);
        setSelectedTab("schedule");
        refresh();
      })
      .catch(handleTransitionError);
  }, [eventCode, token, applyServerState, refresh, handleTransitionError]);

  const handleShowResults = useCallback(
    (row: ControlMatchRow) => {
      if (!token) {
        return;
      }
      postMatchControlShowResults(eventCode, token, toDisplayMatchRef(row))
        .then(() => {
          setTransitionError(null);
        })
        .catch(handleTransitionError);
    },
    [eventCode, token, handleTransitionError]
  );

  return (
    <main className="page-shell">
      <div className="match-control-page">
        <div className="match-control-header">
          <button
            className="button button-secondary"
            onClick={() => refresh()}
            type="button"
          >
            Refresh
          </button>
        </div>

        <h1 className="app-heading app-heading--center">Match Control</h1>

        {data?.activeScheduleType ? (
          <p className="match-control-subheading">
            Active schedule: {MATCH_TYPE_LABELS[data.activeScheduleType]}
          </p>
        ) : (
          <p className="match-control-subheading">No active schedule set.</p>
        )}

        <StatusBar
          activeMatch={activeMatch}
          activeState={activeState}
          loadedMatch={loadedMatch}
          loadedState={loadedState}
          timeRemaining={timeRemaining}
        />

        {transitionError ? (
          <p className="message-block" data-variant="danger" role="alert">
            {transitionError}
          </p>
        ) : null}

        {resetScoreRow ? (
          <div className="match-control-dialog-overlay">
            <div className="match-control-dialog">
              <div className="match-control-dialog-header">
                <h3 className="match-control-dialog-title">Reset Scores?</h3>
                <button
                  className="match-control-dialog-close"
                  disabled={isScoreClearSubmitting}
                  onClick={() => setResetScoreRow(null)}
                  type="button"
                >
                  ×
                </button>
              </div>
              <p className="match-control-dialog-body">
                Reset all saved scores for {resetScoreRow.matchName}? This
                cannot be undone.
              </p>
              <div className="match-control-dialog-actions">
                <button
                  className="match-control-dialog-btn-secondary"
                  disabled={isScoreClearSubmitting}
                  onClick={() => setResetScoreRow(null)}
                  type="button"
                >
                  Close
                </button>
                <button
                  className="match-control-dialog-btn-primary"
                  disabled={isScoreClearSubmitting}
                  onClick={confirmResetScore}
                  type="button"
                >
                  {isScoreClearSubmitting ? "Resetting..." : "Reset Scores"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {replayLoadRow ? (
          <div className="match-control-dialog-overlay">
            <div className="match-control-dialog">
              <div className="match-control-dialog-header">
                <h3 className="match-control-dialog-title">
                  {replayLoadRow.state === "COMMITTED"
                    ? "Replay Match?"
                    : "Clear Scores And Play?"}
                </h3>
                <button
                  className="match-control-dialog-close"
                  disabled={isReplayLoadSubmitting}
                  onClick={() => setReplayLoadRow(null)}
                  type="button"
                >
                  ×
                </button>
              </div>
              <p className="match-control-dialog-body">
                Clear all saved scores for {replayLoadRow.matchName} and load
                it for play? This cannot be undone.
              </p>
              <div className="match-control-dialog-actions">
                <button
                  className="match-control-dialog-btn-secondary"
                  disabled={isReplayLoadSubmitting}
                  onClick={() => setReplayLoadRow(null)}
                  type="button"
                >
                  Close
                </button>
                <button
                  className="match-control-dialog-btn-primary"
                  disabled={isReplayLoadSubmitting}
                  onClick={confirmReplayLoad}
                  type="button"
                >
                  {isReplayLoadSubmitting ? "Loading..." : "Clear And Load"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <ActionBar
          activeState={activeState}
          canLoadNext={canLoadNext}
          loadedState={loadedState}
          onAbort={handleAbortMatch}
          onCommit={handleCommitMatch}
          onLoadNext={handleLoadNextMatch}
          onPause={handlePauseMatch}
          onResume={handleResumeMatch}
          onShowMatch={handleShowMatch}
          onShowPreview={handleShowPreview}
          onStartMatch={handleStartMatch}
          onUnload={handleUnloadMatch}
        />

        {isLoading ? (
          <LoadingIndicator />
        ) : (
          <>
            {error ? (
              <p className="message-block" data-variant="danger" role="alert">
                {error}
              </p>
            ) : null}

            {data?.warnings.map((warning) => (
              <output
                className="message-block"
                data-variant="warning"
                key={warning}
              >
                {warning}
              </output>
            ))}

            <div className="match-control-page-tabs" role="tablist">
              {CONTROL_TABS.map((tab) => (
                <button
                  aria-selected={selectedTab === tab.id}
                  className={`match-control-tab-button ${
                    selectedTab === tab.id ? "active" : ""
                  }`}
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id)}
                  role="tab"
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {selectedTab === "schedule" ? (
              <ControlScheduleTable
                emptyMessage="No matches available for this schedule."
                eventCode={eventCode}
                onLoadMatch={handleLoadMatch}
                onNavigate={onNavigate}
                onResetScore={handleResetScore}
                onShowResults={handleShowResults}
                rows={selectedRows}
                selectedMatch={selectedTableMatch}
              />
            ) : null}

            {selectedTab === "incomplete" ? (
              <ControlScheduleTable
                emptyMessage="No incomplete matches in this schedule."
                eventCode={eventCode}
                onLoadMatch={handleLoadMatch}
                onNavigate={onNavigate}
                onResetScore={handleResetScore}
                onShowResults={handleShowResults}
                rows={incompleteRows}
                selectedMatch={selectedTableMatch}
              />
            ) : null}

            {selectedTab === "score-edit" ? (
              <ScoreEditPanel
                eventCode={eventCode}
                onNavigate={onNavigate}
                rows={selectedRows}
              />
            ) : null}

            {selectedTab === "active" ? (
              <ControlActiveMatchPanel
                activeMatch={activeMatch}
                activeMatchRef={activeMatchRef}
                activeState={activeState}
                eventCode={eventCode}
                timeRemaining={timeRemaining}
                token={token}
              />
            ) : null}

            {selectedTab === "settings" ? (
              <MatchControlSettingsPanel eventCode={eventCode} token={token} />
            ) : null}
          </>
        )}
      </div>
    </main>
  );
};
