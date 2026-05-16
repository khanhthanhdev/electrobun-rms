import sponsorAivf from "@/assets/display-sponsors/sponsor-aivf.png";
import sponsorSteam from "@/assets/display-sponsors/sponsor-steam.png";
import sponsorUsEmbassy from "@/assets/display-sponsors/sponsor-us-embassy.png";

export const DISPLAY_SCENE_SPONSOR_LOGOS = [
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

interface DisplaySceneSponsorLogosProps {
  className?: string;
}

export const DisplaySceneSponsorLogos = ({
  className = "",
}: DisplaySceneSponsorLogosProps): JSX.Element => (
  <ul className={`display-sponsors-logo-list ${className}`.trim()}>
    {DISPLAY_SCENE_SPONSOR_LOGOS.map((sponsor) => (
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
);
