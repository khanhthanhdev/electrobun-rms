import nrcLogo from "../../assets/steam.webp";
import type { AuthUser } from "../../shared/types/auth";

interface AppHeaderProps {
  isAuthLoading: boolean;
  onLoginClick: () => void;
  onLogoutClick: () => Promise<void>;
  user: AuthUser | null;
}

const getRuntimeHost = (): string => {
  if (typeof window === "undefined") {
    return "localhost";
  }

  return window.location.host;
};

export const AppHeader = ({
  isAuthLoading,
  onLoginClick,
  onLogoutClick,
  user,
}: AppHeaderProps): JSX.Element => {
  const handleLogoutClick = (): void => {
    onLogoutClick().catch(() => {
      // Logout errors are handled by the auth hook.
    });
  };

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <p className="site-header__meta">
          <em>Nation Robotics Competition</em>
          <span> running at {getRuntimeHost()}</span>
        </p>

        <div className="site-header__nav">
          <a className="site-header__brand" href="/">
            <img
              alt="Nation Robotics Competition logo"
              className="site-header__logo"
              height={56}
              src={nrcLogo}
              width={56}
            />
            <span className="site-header__brand-name">
              Nation Robotics Competition
            </span>
          </a>

          <div className="site-header__actions">
            <a
              className="site-header__utility-link"
              href="https://www.steamforvietnam.org/"
              rel="noopener noreferrer"
              target="_blank"
            >
              Resources
            </a>
            <a
              className="site-header__utility-link"
              href="https://www.steamforvietnam.org/"
              rel="noopener noreferrer"
              target="_blank"
            >
              Help/Feedback
            </a>

            {!isAuthLoading && user ? (
              <div className="site-header__session">
                <span className="site-header__user">{user.username}</span>
                <button onClick={handleLogoutClick} type="button">
                  Log out
                </button>
              </div>
            ) : null}

            {isAuthLoading || user ? null : (
              <button onClick={onLoginClick} type="button">
                Login
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
