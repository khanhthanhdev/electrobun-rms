import { useDisplayTextSettings } from "../display-text-settings-context";

export const DisplaySceneFooter = (): JSX.Element => {
  const { footerColor, footerFontSize, footerText } = useDisplayTextSettings();

  return (
    <footer className="display-sponsors-footer">
      <div className="display-sponsors-footer-content">
        <span
          className="display-sponsors-footer-title"
          style={{ color: footerColor, fontSize: `${footerFontSize}px` }}
        >
          {footerText}
        </span>
      </div>
    </footer>
  );
};
