import { useDisplayTextSettings } from "../display-text-settings-context";
import { DisplaySceneFooter } from "./display-scene-footer";
import { DisplaySceneHeader } from "./display-scene-header";

interface DisplaySceneLayoutProps {
  ariaLabel: string;
  children?: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
  header?: React.ReactNode;
  mainClassName?: string;
  title?: string;
}

export const DisplaySceneLayout = ({
  ariaLabel,
  children,
  className = "",
  footer,
  header,
  mainClassName = "",
  title,
}: DisplaySceneLayoutProps): JSX.Element => {
  const settings = useDisplayTextSettings();
  const customHeader =
    settings.headerMode === "custom" && settings.customHeaderText
      ? settings.customHeaderText
      : null;

  return (
    <section
      aria-label={ariaLabel}
      className={`display-sponsors-scene ${className}`.trim()}
    >
      {customHeader ? (
        <DisplaySceneHeader title={customHeader} />
      ) : (
        (header ?? (title ? <DisplaySceneHeader title={title} /> : null))
      )}

      <main className={`display-sponsors-main ${mainClassName}`.trim()}>
        {children}
      </main>

      {footer ?? <DisplaySceneFooter />}
    </section>
  );
};
