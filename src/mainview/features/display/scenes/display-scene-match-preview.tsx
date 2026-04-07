import matchPreviewTrophyIcon from "@/assets/display-sponsors/match-preview-trophy-icon.svg";
import matchPreviewVsGraphic from "@/assets/display-sponsors/match-preview-vs.png";
import steamBrandLockup from "@/assets/display-sponsors/steam-header-logo-trimmed.png";

import { DisplaySceneFooter } from "../components/display-scene-footer";

interface MatchPreviewData {
  blueTeam: number;
  blueTeamName: string;
  fieldNumber: number;
  matchName: string;
  redTeam: number;
  redTeamName: string;
}

interface DisplaySceneMatchPreviewProps {
  eventName: string;
  match?: MatchPreviewData | null;
}

const formatHeaderMatchLabel = (
  match: MatchPreviewData | null | undefined
): string => match?.matchName?.trim().toUpperCase() || "MATCH PREVIEW";

const formatHeaderFieldLabel = (
  match: MatchPreviewData | null | undefined
): string => `SÂN THI ĐẤU ${match?.fieldNumber ?? 1}`;

const formatTeamId = (teamNumber: number | undefined): string =>
  teamNumber ? `ID: #${String(teamNumber).padStart(3, "0")}` : "ID: #TBD";

interface AlliancePreviewCardProps {
  alliance: "Blue Alliance" | "Red Alliance";
  className: string;
  teamName: string | undefined;
  teamNumber: number | undefined;
}

const AlliancePreviewCard = ({
  alliance,
  className,
  teamName,
  teamNumber,
}: AlliancePreviewCardProps): JSX.Element => (
  <article
    aria-label={`${alliance}: ${teamName?.trim() || "Team pending"}`}
    className={`display-match-preview-card ${className}`}
  >
    <span className="display-match-preview-team-chip">
      {formatTeamId(teamNumber)}
    </span>
    <p className="display-match-preview-team-name">
      {teamName?.trim() || "Team pending"}
    </p>
    <span className="display-match-preview-team-score">0</span>
  </article>
);

export const DisplaySceneMatchPreview = ({
  eventName,
  match,
}: DisplaySceneMatchPreviewProps): JSX.Element => {
  const headerMatchLabel = formatHeaderMatchLabel(match);
  const headerFieldLabel = formatHeaderFieldLabel(match);

  return (
    <section
      aria-label={`${eventName} match preview scene`}
      className="display-sponsors-scene display-match-preview-scene"
    >
      <header className="display-sponsors-header display-match-preview-header">
        <img
          alt="STEAM For Vietnam"
          className="display-sponsors-brand"
          height={907}
          src={steamBrandLockup}
          width={2534}
        />

        <div className="display-match-preview-header-pill">
          <img
            alt=""
            className="display-match-preview-header-icon"
            height={24}
            src={matchPreviewTrophyIcon}
            width={24}
          />
          <p className="display-match-preview-header-title">
            <span>{headerMatchLabel}</span>
            <span
              aria-hidden="true"
              className="display-match-preview-header-divider"
            >
              |
            </span>
            <span>{headerFieldLabel}</span>
          </p>
        </div>

        <div className="display-match-preview-header-status">
          <div className="display-sponsors-live-badge">
            <span aria-hidden="true" className="display-sponsors-live-dot" />
            <span>Live Feed</span>
          </div>
        </div>
      </header>

      <div className="display-sponsors-main display-match-preview-main">
        <div className="display-match-preview-stage">
          <AlliancePreviewCard
            alliance="Blue Alliance"
            className="display-match-preview-card--blue"
            teamName={match?.blueTeamName}
            teamNumber={match?.blueTeam}
          />

          <div aria-hidden="true" className="display-match-preview-versus">
            <img
              alt=""
              className="display-match-preview-versus-image"
              height={667}
              src={matchPreviewVsGraphic}
              width={1084}
            />
          </div>

          <AlliancePreviewCard
            alliance="Red Alliance"
            className="display-match-preview-card--red"
            teamName={match?.redTeamName}
            teamNumber={match?.redTeam}
          />
        </div>
      </div>
      <DisplaySceneFooter />
    </section>
  );
};
