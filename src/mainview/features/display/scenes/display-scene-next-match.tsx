import { DisplayChrome } from "../display-chrome";
import { formatTimer } from "../display-helpers";
import { useNow } from "../use-now";

interface DisplaySceneNextMatchProps {
  eventName: string;
  nextMatchStartTime?: number | null;
}

export const DisplaySceneNextMatch = ({
  eventName,
  nextMatchStartTime,
}: DisplaySceneNextMatchProps): JSX.Element => {
  const now = useNow(1000);

  let countdownLabel: string;
  if (nextMatchStartTime && nextMatchStartTime > 0) {
    const remainingMs = nextMatchStartTime - now.getTime();
    if (remainingMs > 0) {
      countdownLabel = formatTimer(Math.ceil(remainingMs / 1000));
    } else {
      countdownLabel = "0:00";
    }
  } else {
    countdownLabel = "—";
  }

  return (
    <DisplayChrome eventName={eventName}>
      <div className="display-scene display-scene-next-match">
        <div className="display-scene-center">
          <div className="display-next-match-box">
            <span>Next match expected start:</span>
            <strong>{countdownLabel}</strong>
          </div>
        </div>
      </div>
    </DisplayChrome>
  );
};
