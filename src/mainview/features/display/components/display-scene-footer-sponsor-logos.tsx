import sponsorAivf from "@/assets/display-sponsors/sponsor-aivf.png";
import sponsorSteam from "@/assets/display-sponsors/sponsor-steam.png";
import sponsorUsEmbassy from "@/assets/display-sponsors/sponsor-us-embassy.png";

const FOOTER_SPONSORS = [
  { alt: "U.S. Embassy Hanoi", src: sponsorUsEmbassy },
  { alt: "AI for Vietnam Foundation", src: sponsorAivf },
  { alt: "STEAM For Vietnam", src: sponsorSteam },
] as const;

export const DisplaySceneFooterSponsorLogos = (): JSX.Element => (
  <ul className="display-sponsors-footer-logo-list">
    {FOOTER_SPONSORS.map((sponsor) => (
      <li className="display-sponsors-footer-logo-item" key={sponsor.alt}>
        <img
          alt={sponsor.alt}
          className="display-sponsors-footer-logo"
          height={400}
          src={sponsor.src}
          width={400}
        />
      </li>
    ))}
  </ul>
);
