import { DISPLAY_SCENE_SPONSOR_LOGOS } from "./display-scene-sponsor-logos";

export const DisplaySceneFooterSponsorLogos = (): JSX.Element => (
  <ul className="display-sponsors-footer-logo-list">
    {DISPLAY_SCENE_SPONSOR_LOGOS.map((sponsor) => (
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
