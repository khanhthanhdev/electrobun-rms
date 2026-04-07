import { MATCH_DURATION_SECONDS } from "@shared/match-control";
import hourglassLine from "@/assets/display-sponsors/hourglass-line.svg";
import hourglassOutline from "@/assets/display-sponsors/hourglass-outline.svg";
import steamBrandLockup from "@/assets/display-sponsors/steam-header-logo-trimmed.png";

import { DisplaySceneFooter } from "../components/display-scene-footer";
import { formatTimer } from "../display-helpers";
import type { ScoreBreakdown } from "../use-display-data";
import { useNow } from "../use-now";

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

const toBreakdownItems = (breakdown: ScoreBreakdown | null) =>
  (
    [
      ["A", breakdown?.a ?? 0],
      ["B", breakdown?.b ?? 0],
      ["C", breakdown?.c ?? 0],
      ["D", breakdown?.d ?? 0],
    ] as const
  ).map(([label, value]) => ({ label, value }));

const SponsorHourglassIcon = (): JSX.Element => (
  <span aria-hidden="true" className="display-sponsors-hourglass">
    <img
      alt=""
      className="display-sponsors-hourglass-outline"
      height={28}
      src={hourglassOutline}
      width={20}
    />
    <img
      alt=""
      className="display-sponsors-hourglass-line display-sponsors-hourglass-line--top"
      height={2}
      src={hourglassLine}
      width={7}
    />
    <img
      alt=""
      className="display-sponsors-hourglass-line display-sponsors-hourglass-line--bottom"
      height={2}
      src={hourglassLine}
      width={7}
    />
  </span>
);

const BreakdownItems = ({
  breakdown,
}: {
  breakdown: ScoreBreakdown | null;
}) => (
  <>
    {toBreakdownItems(breakdown).map(({ label, value }) => (
      <span className="display-match-start-breakdown-pill" key={label}>
        <span className="display-match-start-breakdown-key">{label}</span>
        <span className="display-match-start-breakdown-value">{value}</span>
      </span>
    ))}
  </>
);

const AllianceLiveCard = ({
  alliance,
  breakdown,
  className,
  score,
  teamName,
  teamNumber,
}: {
  alliance: "Blue Alliance" | "Red Alliance";
  breakdown: ScoreBreakdown | null;
  className: string;
  score: number;
  teamName: string | undefined;
  teamNumber: number | undefined;
}): JSX.Element => (
  <article className={`display-match-start-card ${className}`}>
    <div className="display-match-start-card-top">
      <span className="display-match-start-card-label">{alliance}</span>
      <span className="display-match-start-card-score">{score}</span>
    </div>
    <div className="display-match-start-card-body">
      <span className="display-match-start-card-team-number">
        {teamNumber ?? "TBD"}
      </span>
      <p className="display-match-start-card-team-name">
        {teamName?.trim() || "Team pending"}
      </p>
    </div>
    <section
      aria-label={`${alliance} score breakdown`}
      className="display-match-start-breakdown"
    >
      <BreakdownItems breakdown={breakdown} />
    </section>
  </article>
);

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
    <section
      aria-label={`${eventName} live match scene`}
      className="display-sponsors-scene display-match-start-scene"
    >
      <header className="display-sponsors-header display-match-start-header">
        <img
          alt="STEAM For Vietnam"
          className="display-sponsors-brand"
          height={907}
          src={steamBrandLockup}
          width={2534}
        />
        <div className="display-match-start-header-copy">
          <span className="display-match-start-field">
            Field {match?.fieldNumber ?? 1}
          </span>
          <h1 className="display-match-start-title">
            {match?.matchName ?? "Match Start"}
          </h1>
        </div>
        <div className="display-match-start-header-status">
          <SponsorHourglassIcon />
          <div className="display-sponsors-live-badge">
            <span aria-hidden="true" className="display-sponsors-live-dot" />
            <span>Match Live</span>
          </div>
        </div>
      </header>
      <div className="display-sponsors-main display-match-start-main">
        <div className="display-match-start-timer-panel">
          <span className="display-match-start-timer-label">
            Time Remaining
          </span>
          <span aria-live="polite" className="display-match-start-timer">
            {formatTimer(timeRemaining)}
          </span>
          <span className="display-match-start-event">{eventName}</span>
        </div>
        <div className="display-match-start-stage">
          <AllianceLiveCard
            alliance="Red Alliance"
            breakdown={redBreakdown}
            className="display-match-start-card--red"
            score={redScore}
            teamName={match?.redTeamName}
            teamNumber={match?.redTeam}
          />
          <div aria-hidden="true" className="display-match-start-versus">
            <span>VS</span>
          </div>
          <AllianceLiveCard
            alliance="Blue Alliance"
            breakdown={blueBreakdown}
            className="display-match-start-card--blue"
            score={blueScore}
            teamName={match?.blueTeamName}
            teamNumber={match?.blueTeam}
          />
        </div>
        <div className="display-match-start-meta">
          <span className="display-match-start-meta-label">Event</span>
          <span className="display-match-start-meta-value">{eventName}</span>
        </div>
      </div>
      <DisplaySceneFooter />
    </section>
  );
};
