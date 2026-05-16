import matchPreviewVsGraphic from "@/assets/display-sponsors/match-preview-vs.png";

import { DisplaySceneLayout } from "../components/display-scene-layout";
import { DisplaySceneMatchHeader } from "../components/display-scene-match-header";

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
    className={`display-match-preview-card display-match-preview-card--preview ${className}`}
  >
    <span className="display-match-preview-team-chip">
      {formatTeamId(teamNumber)}
    </span>
    <div className="display-match-preview-card-body">
      <p className="display-match-preview-team-name">
        {teamName?.trim() || "Team pending"}
      </p>
      <span className="display-match-preview-team-score">0</span>
    </div>
  </article>
);

export const DisplaySceneMatchPreview = ({
  eventName,
  match,
}: DisplaySceneMatchPreviewProps): JSX.Element => {
  const headerMatchLabel = formatHeaderMatchLabel(match);

  return (
    <DisplaySceneLayout
      ariaLabel={`${eventName} match preview scene`}
      className="display-match-preview-scene"
      header={
        <DisplaySceneMatchHeader
          fieldNumber={match?.fieldNumber}
          matchLabel={headerMatchLabel}
        />
      }
      mainClassName="display-match-preview-main"
    >
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
    </DisplaySceneLayout>
  );
};
