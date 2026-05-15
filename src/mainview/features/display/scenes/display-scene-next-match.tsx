import hourglassLine from "@/assets/display-sponsors/hourglass-line.svg";
import hourglassOutline from "@/assets/display-sponsors/hourglass-outline.svg";
import sponsorAivf from "@/assets/display-sponsors/sponsor-aivf.png";
import sponsorSteam from "@/assets/display-sponsors/sponsor-steam.png";
import sponsorUsEmbassy from "@/assets/display-sponsors/sponsor-us-embassy.png";
import steamBrandLockup from "@/assets/display-sponsors/steam-header-logo-trimmed.png";

import { DisplaySceneFooter } from "../components/display-scene-footer";
import { formatTimer } from "../display-helpers";
import { useNow } from "../use-now";

const SPONSOR_LOGOS = [
  {
    alt: "U.S. Embassy Hanoi",
    src: sponsorUsEmbassy,
  },
  {
    alt: "AI for Vietnam Foundation",
    src: sponsorAivf,
  },
  {
    alt: "STEAM For Vietnam",
    src: sponsorSteam,
  },
] as const;

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
    <section
      aria-label={`${eventName} next match scene`}
      className="display-sponsors-scene"
    >
      <header className="display-sponsors-header">
        <img
          alt="STEAM For Vietnam"
          className="display-sponsors-brand"
          height={907}
          src={steamBrandLockup}
          width={2534}
        />
      

      </header>

      <div className="display-sponsors-main display-next-match-main">
        <ul className="display-sponsors-logo-list display-next-match-logo-list">
          {SPONSOR_LOGOS.map((sponsor) => (
            <li className="display-sponsors-logo-item" key={sponsor.alt}>
              <img
                alt={sponsor.alt}
                className="display-sponsors-logo"
                height={400}
                src={sponsor.src}
                width={400}
              />
            </li>
          ))}
        </ul>

        <div className="display-next-match-countdown-card">
          <p className="display-next-match-countdown-label">
            Tran dau tiep theo bat dau trong
          </p>
          <span className="display-next-match-countdown-time">
            {countdownLabel}
          </span>
        </div>
      </div>
      <DisplaySceneFooter />
    </section>
  );
};
