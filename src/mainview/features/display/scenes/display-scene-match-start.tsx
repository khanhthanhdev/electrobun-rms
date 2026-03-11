import { formatTimer } from "../display-helpers";
import type { ScoreBreakdown } from "../use-display-data";
import { useNow } from "../use-now";

const MATCH_DURATION_SECONDS = 150;

interface MatchStartData {
  blueBreakdown: ScoreBreakdown | null;
  blueScore: number;
  blueTeam: number;
  blueTeamName: string;
  fieldNumber: number;
  matchName: string;
  redBreakdown: ScoreBreakdown | null;
  redScore: number;
  redTeam: number;
  redTeamName: string;
}

interface DisplaySceneMatchStartProps {
  eventName: string;
  match?: MatchStartData | null;
  matchStartedAtMs?: number | null;
}

const formatBreakdown = (b: ScoreBreakdown | null): string => {
  if (!b) {
    return "A:0 B:0 C:0 D:0";
  }
  return `A:${b.a} B:${b.b} C:${b.c} D:${b.d}`;
};

export const DisplaySceneMatchStart = ({
  eventName,
  match,
  matchStartedAtMs,
}: DisplaySceneMatchStartProps): JSX.Element => {
  const now = useNow(1000);

  const elapsed = matchStartedAtMs
    ? Math.floor((now.getTime() - matchStartedAtMs) / 1000)
    : 0;
  const timeRemaining = Math.max(0, MATCH_DURATION_SECONDS - elapsed);

  const redScore = match?.redScore ?? 0;
  const blueScore = match?.blueScore ?? 0;
  const redBreakdown = match?.redBreakdown ?? null;
  const blueBreakdown = match?.blueBreakdown ?? null;

  return (
    <div className="display-scene display-scene-match-start">
      {/* Top bar: Field + Gear */}
      <header className="display-match-start-header">
        <span className="display-match-start-field">
          Field {match?.fieldNumber ?? 1}
        </span>
        <button
          aria-label="Display options"
          className="display-match-start-gear"
          type="button"
        >
          Gear
        </button>
      </header>

      {/* Center: Big timer + status dots */}
      <div className="display-match-start-center">
        <div className="display-match-timer-box">
          <span aria-live="polite" className="display-match-timer">
            {formatTimer(timeRemaining)}
          </span>
        </div>
        <div aria-hidden className="display-match-status-dots">
          <span className="display-match-status-dot" />
          <span className="display-match-status-dot" />
          <span className="display-match-status-dot" />
        </div>
      </div>

      {/* Bottom: Lower-thirds score bar */}
      <footer className="display-match-start-footer">
        <div className="display-match-start-footer-branding">
          <span className="display-match-start-event">{eventName}</span>
          <span className="display-match-start-match-name">
            {match?.matchName ?? "—"}
          </span>
        </div>
        <div className="display-match-start-scorebar">
          <div className="display-match-start-alliance display-match-start-red">
            <span className="display-match-start-label">RED</span>
            <span className="display-match-start-team">
              {match?.redTeam ?? "—"}
            </span>
            <span className="display-match-start-score">{redScore}</span>
            <span className="display-match-start-breakdown">
              {formatBreakdown(redBreakdown)}
            </span>
          </div>
          <span className="display-match-start-vs">VS</span>
          <div className="display-match-start-alliance display-match-start-blue">
            <span className="display-match-start-label">BLUE</span>
            <span className="display-match-start-team">
              {match?.blueTeam ?? "—"}
            </span>
            <span className="display-match-start-score">{blueScore}</span>
            <span className="display-match-start-breakdown">
              {formatBreakdown(blueBreakdown)}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
