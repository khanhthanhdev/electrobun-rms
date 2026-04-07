import { DisplaySceneFooterSponsorLogos } from "./display-scene-footer-sponsor-logos";

export const DisplaySceneFooter = (): JSX.Element => (
  <footer className="display-sponsors-footer">
    <div className="display-sponsors-footer-content">
      <DisplaySceneFooterSponsorLogos />
      <span className="display-sponsors-footer-title">
        National Robotics Competition 2026
      </span>
    </div>
  </footer>
);
