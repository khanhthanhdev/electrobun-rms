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
}: DisplaySceneLayoutProps): JSX.Element => (
  <section
    aria-label={ariaLabel}
    className={`display-sponsors-scene ${className}`.trim()}
  >
    {header ?? (title ? <DisplaySceneHeader title={title} /> : null)}

    <main className={`display-sponsors-main ${mainClassName}`.trim()}>
      {children}
    </main>

    {footer ?? <DisplaySceneFooter />}
  </section>
);
