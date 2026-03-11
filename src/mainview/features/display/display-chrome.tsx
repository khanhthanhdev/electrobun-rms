/**
 * Shared header/footer chrome for display scenes.
 */

import { useNow } from "./use-now";

interface DisplayChromeProps {
  children: React.ReactNode;
  eventName?: string;
  showGear?: boolean;
}

export const DisplayChrome = ({
  children,
  eventName = "Event",
  showGear = true,
}: DisplayChromeProps): JSX.Element => {
  const now = useNow(1000);

  return (
    <div className="display-chrome">
      <header className="display-chrome-header">
        <span className="display-chrome-title">{eventName}</span>
        {showGear ? (
          <button
            aria-label="Display options"
            className="display-chrome-gear"
            type="button"
          >
            Gear
          </button>
        ) : null}
      </header>
      <div className="display-chrome-body">{children}</div>
      <footer className="display-chrome-footer">
        <span className="display-chrome-time">
          {now.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <span className="display-chrome-event">{eventName}</span>
      </footer>
    </div>
  );
};
