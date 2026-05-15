import matchPreviewTrophyIcon from "@/assets/display-sponsors/match-preview-trophy-icon.svg";
import steamBrandLockup from "@/assets/display-sponsors/steam-header-logo-trimmed.png";

interface DisplaySceneMatchHeaderProps {
  fieldNumber?: number;
  matchLabel: string;
}

export const DisplaySceneMatchHeader = ({
  fieldNumber = 1,
  matchLabel,
}: DisplaySceneMatchHeaderProps): JSX.Element => (
  <header className="display-sponsors-header display-match-preview-header">
    <img
      alt="STEAM For Vietnam"
      className="display-sponsors-brand"
      height={907}
      src={steamBrandLockup}
      width={2534}
    />
    <div className="display-match-preview-header-pill">
      <img
        alt=""
        className="display-match-preview-header-icon"
        height={24}
        src={matchPreviewTrophyIcon}
        width={24}
      />
      <p className="display-match-preview-header-title">
        <span>{matchLabel}</span>
        <span
          aria-hidden="true"
          className="display-match-preview-header-divider"
        >
          |
        </span>
        <span>SÂN THI ĐẤU {fieldNumber}</span>
      </p>
    </div>
  </header>
);
