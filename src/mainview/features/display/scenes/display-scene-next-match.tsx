import { DisplaySceneLayout } from "../components/display-scene-layout";
import { DisplaySceneSponsorLogos } from "../components/display-scene-sponsor-logos";
import { formatTimer } from "../display-helpers";
import { useNow } from "../use-now";

interface DisplaySceneNextMatchProps {
  eventName: string;
  nextMatchStartTime?: number | null;
}

const formatCountdownLabel = (
  nextMatchStartTime: number | null | undefined,
  now: Date
): string => {
  if (!nextMatchStartTime || nextMatchStartTime <= 0) {
    return "00:00";
  }

  const remainingMs = nextMatchStartTime - now.getTime();
  if (remainingMs <= 0) {
    return "00:00";
  }

  const [mins, secs] = formatTimer(Math.ceil(remainingMs / 1000)).split(":");
  return `${mins.padStart(2, "0")}:${secs ?? "00"}`;
};

export const DisplaySceneNextMatch = ({
  eventName,
  nextMatchStartTime,
}: DisplaySceneNextMatchProps): JSX.Element => {
  const now = useNow(1000);
  const countdownLabel = formatCountdownLabel(nextMatchStartTime, now);

  return (
    <DisplaySceneLayout
      ariaLabel={`${eventName} next match scene`}
      mainClassName="display-next-match-main"
      title="Next Match"
    >
      <DisplaySceneSponsorLogos className="display-next-match-logo-list" />

      <div className="display-next-match-countdown-card">
        <p className="display-next-match-countdown-label">
          Tran dau tiep theo bat dau trong
        </p>
        <span className="display-next-match-countdown-time">
          {countdownLabel}
        </span>
      </div>
    </DisplaySceneLayout>
  );
};
