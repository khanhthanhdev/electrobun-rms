import type { DisplayMatchRef } from "@shared/display";
import type { MatchControlState } from "@shared/match-control";
import { MATCH_DURATION_SECONDS } from "@shared/match-control";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { publishDisplayCommand } from "@/features/display/display-command-channel";
import {
  fetchMatchControlState,
  getMatchControlRealtimeState,
  MatchControlTransitionError,
  postMatchControlLoad,
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
import { getSceneForAction } from "./display-action-to-scene-map";

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
type ActiveMatchState = "idle" | "in_progress" | "completed";

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
  completed: "Complete",
};

const ACTIVE_STATE_CSS: Record<ActiveMatchState, string> = {
  idle: "",
  in_progress: "match-control-status-badge--in-progress",
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
  onShowMatch: () => void;
  onShowPreview: () => void;
  onStartMatch: () => void;
  onUnload: () => void;
}): JSX.Element => {
  const [showAbortDialog, setShowAbortDialog] = useState(false);
  const isInProgress = activeState === "in_progress";
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
          {isInProgress ? (
            <button
              className="button match-control-action-btn--abort"
              onClick={() => setShowAbortDialog(true)}
              type="button"
            >
              Abort Match
            </button>
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
            Commit &amp; Post Last Match
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

const MATCH_CONTROL_SETTINGS_KEY = "match-control-settings";

interface MatchControlSettings {
  allowExtRandomization: boolean;
  enableHrControl: boolean;
  enablePenaltyTablets: boolean;
  flipAlliances: boolean;
  requireRefInit: boolean;
  useLiveScoring: boolean;
}

const DEFAULT_SETTINGS: MatchControlSettings = {
  allowExtRandomization: false,
  enableHrControl: false,
  enablePenaltyTablets: false,
  flipAlliances: false,
  requireRefInit: false,
  useLiveScoring: true,
};

const loadMatchControlSettings = (): MatchControlSettings => {
  try {
    const raw = localStorage.getItem(MATCH_CONTROL_SETTINGS_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(raw) as Partial<MatchControlSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const saveMatchControlSettings = (s: MatchControlSettings): void => {
  try {
    localStorage.setItem(MATCH_CONTROL_SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
};

const SettingsPanel = ({
  eventCode,
  token,
}: {
  eventCode: string;
  token: string | null;
}): JSX.Element => {
  const [settings, setSettings] = useState<MatchControlSettings>(
    loadMatchControlSettings
  );

  useEffect(() => {
    saveMatchControlSettings(settings);
  }, [settings]);

  const update = useCallback(
    (key: keyof MatchControlSettings, value: boolean) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  return (
    <div className="match-control-settings-panel">
      <div className="match-control-settings-group">
        <h3 className="match-control-settings-group-title">
          Live Scoring Options
        </h3>
        <div className="match-control-setting-row">
          <span className="match-control-setting-label">Use Live Scoring</span>
          <input
            checked={settings.useLiveScoring}
            onChange={(e) => update("useLiveScoring", e.target.checked)}
            type="checkbox"
          />
        </div>
        <div className="match-control-setting-row">
          <span className="match-control-setting-label">
            Require Referee Init Submit Before Start
          </span>
          <input
            checked={settings.requireRefInit}
            onChange={(e) => update("requireRefInit", e.target.checked)}
            type="checkbox"
          />
        </div>
        <div className="match-control-setting-row">
          <span className="match-control-setting-label">
            Enable Penalty Referee Tablets
          </span>
          <input
            checked={settings.enablePenaltyTablets}
            onChange={(e) => update("enablePenaltyTablets", e.target.checked)}
            type="checkbox"
          />
        </div>
        <div className="match-control-setting-row">
          <span className="match-control-setting-label">
            Enable HR Match Control (Beta)
          </span>
          <input
            checked={settings.enableHrControl}
            onChange={(e) => update("enableHrControl", e.target.checked)}
            type="checkbox"
          />
        </div>
        <div className="match-control-setting-row">
          <span className="match-control-setting-label">
            Allow External Randomization
          </span>
          <input
            checked={settings.allowExtRandomization}
            onChange={(e) => update("allowExtRandomization", e.target.checked)}
            type="checkbox"
          />
        </div>
      </div>

      <div className="match-control-settings-group">
        <h3 className="match-control-settings-group-title">
          Control Page Appearance
        </h3>
        <div className="match-control-setting-row">
          <span className="match-control-setting-label">Flip Alliances</span>
          <input
            checked={settings.flipAlliances}
            onChange={(e) => update("flipAlliances", e.target.checked)}
            type="checkbox"
          />
        </div>
      </div>

      <div className="match-control-settings-group">
        <h3 className="match-control-settings-group-title">
          Set Audience Display
        </h3>
        <p className="match-control-setting-hint">
          Switch the audience display to these modes (same browser/device).
        </p>
        <div className="match-control-display-buttons">
          <button
            className="button"
            onClick={() =>
              publishDisplayCommand(
                eventCode,
                { mode: getSceneForAction("show-blank") },
                token
              )
            }
            type="button"
          >
            Show Blank Screen
          </button>
          <button
            className="button"
            onClick={() =>
              publishDisplayCommand(
                eventCode,
                { mode: getSceneForAction("show-ranking") },
                token
              )
            }
            type="button"
          >
            Show Ranks &amp; Results
          </button>
          <button
            className="button"
            onClick={() =>
              publishDisplayCommand(
                eventCode,
                { mode: getSceneForAction("show-inspection") },
                token
              )
            }
            type="button"
          >
            Show Inspection Status
          </button>
          <button
            className="button"
            onClick={() =>
              publishDisplayCommand(
                eventCode,
                {
                  mode: getSceneForAction("show-message"),
                  message: "Wait for next match",
                },
                token
              )
            }
            type="button"
          >
            Show Message
          </button>
          <button
            className="button"
            onClick={() =>
              publishDisplayCommand(
                eventCode,
                { mode: getSceneForAction("show-sponsors") },
                token
              )
            }
            type="button"
          >
            Show Sponsors
          </button>
        </div>
      </div>
    </div>
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
    if (activeState === "in_progress" && activeStartedAtMs) {
      setTimeRemaining(
        computeTimeRemaining(activeStartedAtMs, MATCH_DURATION_SECONDS)
      );
    } else if (activeState === "idle") {
      setTimeRemaining(MATCH_DURATION_SECONDS);
    }
  }, [activeState, activeStartedAtMs]);

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
        if (row.state !== "UNPLAYED") {
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

  const handleLoadNextMatch = useCallback(() => {
    if (!token || !nextLoadableMatch) {
      return;
    }
    const loadFn = () =>
      postMatchControlLoad(
        eventCode,
        token,
        toDisplayMatchRef(nextLoadableMatch),
        versionRef.current
      )
        .then((res) => applyServerState(res.state))
        .catch(handleTransitionError);

    if (loadedMatchRef) {
      postMatchControlTransition(eventCode, token, "unload", versionRef.current)
        .then((res) => {
          applyServerState(res.state);
          return loadFn();
        })
        .catch(handleTransitionError);
    } else {
      loadFn();
    }
  }, [
    nextLoadableMatch,
    loadedMatchRef,
    eventCode,
    token,
    applyServerState,
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
      const loadFn = () =>
        postMatchControlLoad(
          eventCode,
          token,
          toDisplayMatchRef(row),
          versionRef.current
        )
          .then((res) => applyServerState(res.state))
          .catch(handleTransitionError);

      if (loadedMatchRef) {
        postMatchControlTransition(eventCode, token, "unload", versionRef.current)
          .then((res) => {
            applyServerState(res.state);
            return loadFn();
          })
          .catch(handleTransitionError);
      } else {
        loadFn();
      }
    },
    [
      activeMatchRef,
      loadedMatchRef,
      selectedMatchType,
      selectedRows,
      eventCode,
      token,
      applyServerState,
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
    postMatchControlTransition(
      eventCode,
      token,
      "unload",
      versionRef.current
    )
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

  const handleCommitMatch = useCallback(() => {
    if (!token) {
      return;
    }
    postMatchControlTransition(eventCode, token, "commit", versionRef.current)
      .then((res) => {
        applyServerState(res.state);
        refresh();
      })
      .catch(handleTransitionError);
  }, [eventCode, token, applyServerState, refresh, handleTransitionError]);

  return (
    <main className="page-shell">
      <div className="match-control-page">
        <div className="match-control-header">
          <a
            className="app-link-inline"
            href={`/event/${eventCode}`}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(`/event/${eventCode}`);
            }}
          >
            &lt;&lt; Back to Event Home
          </a>
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

        <ActionBar
          activeState={activeState}
          canLoadNext={canLoadNext}
          loadedState={loadedState}
          onAbort={handleAbortMatch}
          onCommit={handleCommitMatch}
          onLoadNext={handleLoadNextMatch}
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
                onNavigate={onNavigate}
                timeRemaining={timeRemaining}
                token={token}
              />
            ) : null}

            {selectedTab === "settings" ? (
              <SettingsPanel eventCode={eventCode} token={token} />
            ) : null}
          </>
        )}
      </div>
    </main>
  );
};
