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
    activeMatch,
    loadedMatch,
    mode: sceneMode,
    matchStartedAtMs,
    message,
    pausedRemainingMs,
  } = useDisplayCommand(eventCode, token);

  return (
    <main aria-label="Audience display" className="audience-display-page">
      <DisplaySceneRenderer
        activeMatch={activeMatch}
        eventCode={eventCode}
        loadedMatch={loadedMatch}
        matchStartedAtMs={matchStartedAtMs}
        message={message}
        pausedRemainingMs={pausedRemainingMs}
        sceneMode={sceneMode}
        token={token}
      />
    </main>
  );
};
