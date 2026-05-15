import steamBrandLockup from "@/assets/display-sponsors/steam-header-logo-trimmed.png";

interface DisplaySceneHeaderProps {
  rightIconSrc?: string;
  title: string;
}

export const DisplaySceneHeader = ({
  rightIconSrc,
  title,
}: DisplaySceneHeaderProps): JSX.Element => (
  <header className="display-sponsors-header display-scene-header">
    <img
      alt="STEAM For Vietnam"
      className="display-sponsors-brand"
      height={907}
      src={steamBrandLockup}
      width={2534}
    />

    <h1 className="display-scene-header-title">{title}</h1>

    {rightIconSrc ? (
      <img
        alt=""
        className="display-scene-header-icon"
        height={24}
        src={rightIconSrc}
        width={24}
      />
    ) : (
      <span aria-hidden="true" className="display-scene-header-spacer" />
    )}
  </header>
);
