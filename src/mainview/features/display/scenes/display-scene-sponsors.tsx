import hourglassLine from "@/assets/display-sponsors/hourglass-line.svg";
import hourglassOutline from "@/assets/display-sponsors/hourglass-outline.svg";
import sponsorAivf from "@/assets/display-sponsors/sponsor-aivf.png";
import sponsorSteam from "@/assets/display-sponsors/sponsor-steam.png";
import sponsorUsEmbassy from "@/assets/display-sponsors/sponsor-us-embassy.png";
import steamBrandLockup from "@/assets/display-sponsors/steam-header-logo-trimmed.png";

import { DisplaySceneFooter } from "../components/display-scene-footer";

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

interface DisplaySceneSponsorsProps {
  eventName: string;
}

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

export const DisplaySceneSponsors = ({
  eventName,
}: DisplaySceneSponsorsProps): JSX.Element => (
  <section
    aria-label={`${eventName} sponsors scene`}
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
      <SponsorHourglassIcon />

    </header>

    <div className="display-sponsors-main">
      <h1 className="display-sponsors-title">Nhà tài trợ</h1>
      <ul className="display-sponsors-logo-list">
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
    </div>
    <DisplaySceneFooter />
  </section>
);
