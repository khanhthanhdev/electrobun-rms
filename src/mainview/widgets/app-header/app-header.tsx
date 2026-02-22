import { useState } from "react";
import nrcLogo from "../../assets/steam.webp";
import type { AuthUser } from "../../shared/types/auth";

interface AppHeaderProps {
  isAuthLoading: boolean;
  onLoginClick: () => void;
  onLogoutClick: () => Promise<void>;
  onNavigate: (path: string) => void;
  showAdminMenu: boolean;
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
  onNavigate,
  onLoginClick,
  onLogoutClick,
  showAdminMenu,
  user,
}: AppHeaderProps): JSX.Element => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogoutClick = (): void => {
    onLogoutClick().catch(() => {
      // Logout errors are handled by the auth hook.
    });
  };

  const toggleMenu = (): void => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleNavigation =
    (path: string) =>
    (event: React.MouseEvent<HTMLAnchorElement>): void => {
      event.preventDefault();
      const menuRoot = event.currentTarget.closest("details");
      if (menuRoot) {
        menuRoot.removeAttribute("open");
      }
      setIsMenuOpen(false);
      onNavigate(path);
    };

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <p className="site-header__meta">
          <em>Nation Robotics Competition</em>
          <span> running at {getRuntimeHost()}</span>
        </p>

        <div className="site-header__nav">
          <div className="site-header__brand-group">
            <a
              className="site-header__brand"
              href="/"
              onClick={handleNavigation("/")}
            >
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

            <button
              aria-expanded={isMenuOpen}
              aria-label="Toggle navigation menu"
              className="site-header__menu-toggle"
              onClick={toggleMenu}
              type="button"
            >
              <svg
                fill="none"
                height="24"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <title>{isMenuOpen ? "Close menu" : "Open menu"}</title>
                {isMenuOpen ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          <div
            className={`site-header__collapsible ${isMenuOpen ? "is-open" : ""}`}
          >
            {showAdminMenu ? (
              <details className="site-header__admin-menu">
                <summary>ADMIN</summary>
                <div className="site-header__admin-dropdown">
                  <a
                    href="/create/event"
                    onClick={handleNavigation("/create/event")}
                  >
                    Setup Event
                  </a>
                  <a
                    href="/create/account"
                    onClick={handleNavigation("/create/account")}
                  >
                    Create User
                  </a>
                  <a
                    href="/user/manage"
                    onClick={handleNavigation("/user/manage")}
                  >
                    Manage Users
                  </a>
                  <a
                    href="/manage/server"
                    onClick={handleNavigation("/manage/server")}
                  >
                    Manage Server
                  </a>
                </div>
              </details>
            ) : null}

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
      </div>
    </header>
  );
};
