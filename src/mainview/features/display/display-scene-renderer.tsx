import type { DisplayMatchRef } from "@shared/display";
import type { DisplaySceneMode } from "./display-scene-types";
import { DisplaySceneBlank } from "./scenes/display-scene-blank";
import { DisplaySceneMatchPreview } from "./scenes/display-scene-match-preview";
import { DisplaySceneMatchStart } from "./scenes/display-scene-match-start";
import { DisplaySceneMatchWinner } from "./scenes/display-scene-match-winner";
import { DisplaySceneNextMatch } from "./scenes/display-scene-next-match";
import { DisplaySceneRankingResult } from "./scenes/display-scene-ranking-result";
import { DisplaySceneRobotInspectionStatus } from "./scenes/display-scene-robot-inspection-status";
import { DisplaySceneSponsors } from "./scenes/display-scene-sponsors";
import { DisplaySceneTextNotification } from "./scenes/display-scene-text-notification";
import { useDisplayData } from "./use-display-data";

interface DisplaySceneRendererProps {
  activeMatch: DisplayMatchRef | null;
  eventCode: string;
  loadedMatch: DisplayMatchRef | null;
  matchStartedAtMs: number | null;
  message: string;
  sceneMode: DisplaySceneMode;
  token: string | null;
}

export const DisplaySceneRenderer = ({
  activeMatch,
  eventCode,
  loadedMatch,
  matchStartedAtMs,
  sceneMode,
  message,
  token,
}: DisplaySceneRendererProps): JSX.Element => {
  const data = useDisplayData(eventCode, token, {
    activeMatch,
    loadedMatch,
    sceneMode,
  });
  const eventName = data.eventName || eventCode;

  switch (sceneMode) {
    case "next-match":
      return (
        <DisplaySceneNextMatch
          eventName={eventName}
          nextMatchStartTime={data.nextMatchStartTime}
        />
      );
    case "match-preview":
      return (
        <DisplaySceneMatchPreview
          eventName={eventName}
          match={
            data.loadedMatch
              ? {
                  matchName: data.loadedMatch.matchName,
                  fieldNumber: data.loadedMatch.fieldNumber,
                  redTeam: data.loadedMatch.redTeam,
                  redTeamName: data.loadedMatch.redTeamName,
                  blueTeam: data.loadedMatch.blueTeam,
                  blueTeamName: data.loadedMatch.blueTeamName,
                }
              : null
          }
        />
      );
    case "match-start":
      return (
        <DisplaySceneMatchStart
          eventName={eventName}
          match={data.loadedMatch}
          matchStartedAtMs={matchStartedAtMs}
        />
      );
    case "match-complete":
      return (
        <DisplaySceneMatchStart
          eventName={eventName}
          isCompleted
          match={data.loadedMatch}
          matchStartedAtMs={matchStartedAtMs}
        />
      );
    case "match-winner":
      return (
        <DisplaySceneMatchWinner
          eventName={eventName}
          match={data.loadedMatch}
          matchStartedAtMs={matchStartedAtMs}
        />
      );
    case "blank":
      return <DisplaySceneBlank eventName={eventName} />;
    case "ranking-result":
      return (
        <DisplaySceneRankingResult
          eventName={eventName}
          matchesPlayed={data.matchesPlayed}
          rankings={data.rankings}
        />
      );
    case "robot-inspection-status":
      return (
        <DisplaySceneRobotInspectionStatus
          eventName={eventName}
          teams={data.inspectionTeams.map((t) => ({
            teamNumber: t.teamNumber,
            teamName: t.teamName,
            status: t.status as
              | "NOT_STARTED"
              | "IN_PROGRESS"
              | "PASSED"
              | "READY"
              | "INCOMPLETE",
          }))}
        />
      );
    case "text-notification":
      return (
        <DisplaySceneTextNotification eventName={eventName} message={message} />
      );
    case "sponsors":
      return <DisplaySceneSponsors eventName={eventName} />;
    default:
      return (
        <DisplaySceneNextMatch
          eventName={eventName}
          nextMatchStartTime={data.nextMatchStartTime}
        />
      );
  }
};
