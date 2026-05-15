import sponsorAivf from "@/assets/display-sponsors/sponsor-aivf.png";
import sponsorSteam from "@/assets/display-sponsors/sponsor-steam.png";
import sponsorUsEmbassy from "@/assets/display-sponsors/sponsor-us-embassy.png";

import { DisplaySceneFooter } from "../components/display-scene-footer";
import { DisplaySceneHeader } from "../components/display-scene-header";

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

export const DisplaySceneSponsors = ({
  eventName,
}: DisplaySceneSponsorsProps): JSX.Element => (
  <section
    aria-label={`${eventName} sponsors scene`}
    className="display-sponsors-scene"
  >
    <DisplaySceneHeader title="Nhà tài trợ" />

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
