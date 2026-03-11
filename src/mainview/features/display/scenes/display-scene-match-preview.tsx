import { DisplayChrome } from "../display-chrome";

interface MatchPreviewData {
  blueTeam: number;
  blueTeamName: string;
  matchName: string;
  redTeam: number;
  redTeamName: string;
}

interface DisplaySceneMatchPreviewProps {
  eventName: string;
  match?: MatchPreviewData | null;
}

export const DisplaySceneMatchPreview = ({
  eventName,
  match,
}: DisplaySceneMatchPreviewProps): JSX.Element => (
  <DisplayChrome eventName={eventName}>
    <div className="display-scene display-scene-match-preview">
      <div className="display-scene-header-row">
        <h2>Up Next</h2>
        <span>{match?.matchName ?? "—"}</span>
      </div>
      <div className="display-scene-match-area">
        <div className="display-alliance-card display-alliance-red">
          <span className="display-team-number">{match?.redTeam ?? "—"}</span>
          <span className="display-team-name">
            {match?.redTeamName ?? "Red Team"}
          </span>
        </div>
        <span className="display-vs">VS</span>
        <div className="display-alliance-card display-alliance-blue">
          <span className="display-team-number">{match?.blueTeam ?? "—"}</span>
          <span className="display-team-name">
            {match?.blueTeamName ?? "Blue Team"}
          </span>
        </div>
      </div>
    </div>
  </DisplayChrome>
);
