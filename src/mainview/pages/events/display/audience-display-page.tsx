import { DisplaySceneRenderer } from "@/features/display/display-scene-renderer";
import { useDisplayCommand } from "@/features/display/use-display-command";

interface AudienceDisplayPageProps {
  eventCode: string;
  token: string | null;
}

export const AudienceDisplayPage = ({
  eventCode,
  token,
}: AudienceDisplayPageProps): JSX.Element => {
  const {
    mode: sceneMode,
    matchStartedAtMs,
    message,
  } = useDisplayCommand(eventCode, token);

  return (
    <main aria-label="Audience display" className="audience-display-page">
      <DisplaySceneRenderer
        eventCode={eventCode}
        matchStartedAtMs={matchStartedAtMs}
        message={message}
        sceneMode={sceneMode}
        token={token}
      />
    </main>
  );
};
