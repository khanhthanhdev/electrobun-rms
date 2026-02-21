import { useEffect, useRef, useState } from "react";
import { LoginForm } from "../features/auth/components/login-dialog";
import { useAuth } from "../features/auth/hooks/use-auth";
import { useEvents } from "../features/events/hooks/use-events";
import { AdminPlaceholderPage } from "../pages/admin/admin-placeholder-page";
import { CreateEventPage } from "../pages/events/create-event-page";
import { DefaultAccountsPage } from "../pages/events/default-accounts-page";
import { EditEventPage } from "../pages/events/edit-event-page";
import { EventDashboardPage } from "../pages/events/event-dashboard-page";
import { EventPage } from "../pages/events/event-page";
import { HomePage } from "../pages/home/home-page";
import { CreateAccountPage } from "../pages/users/create-account-page";
import { ManageUserPage } from "../pages/users/manage-user-page";
import { ManageUsersPage } from "../pages/users/manage-users-page";
import { LoadingIndicator } from "../shared/components/loading-indicator";
import type { AuthUser, LoginCredentials } from "../shared/types/auth";
import { AppHeader } from "../widgets/app-header/app-header";

const readCurrentPath = (): string => {
  if (typeof window === "undefined") {
    return "/";
  }

  return window.location.pathname;
};

const EDIT_EVENT_PATTERN = /^\/event\/([^/]+)\/edit\/?$/;
const EVENT_DASHBOARD_PATTERN = /^\/event\/([^/]+)\/dashboard\/?$/;
const DEFAULT_ACCOUNTS_PATTERN =
  /^\/event\/([^/]+)\/dashboard\/defaultaccounts\/?$/;
const CREATE_EVENT_PATTERN = /^\/create\/event\/?$/;
const CREATE_ACCOUNT_PATTERN = /^\/create\/account\/?$/;
const EVENT_DETAIL_PATTERN = /^\/event\/([^/]+)\/?$/;
const MANAGE_USERS_PATTERN =
  /^(?:\/(?:user|users)\/manage|\/manage\/users)\/?$/;
const MANAGE_USER_DETAIL_PATTERN =
  /^(?:\/(?:user|users)\/manage\/([^/]+)|\/manage\/users\/([^/]+))\/?$/;
const MANAGE_SERVER_PATTERN = /^\/manage\/server\/?$/;

const hasAdminGlobalRole = (user: AuthUser | null): boolean =>
  Boolean(
    user?.roles.some((role) => role.role === "ADMIN" && role.event === "*")
  );

const decodePathSegment = (value: string): string | null => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

const RouteErrorPage = ({ message }: { message: string }): JSX.Element => (
  <main className="page-shell page-shell--center">
    <div className="card surface-card surface-card--small stack stack--compact">
      <p className="message-block" data-variant="danger" role="alert">
        {message}
      </p>
      <a className="app-link-inline" href="/">
        Back to Home
      </a>
    </div>
  </main>
);

const App = (): JSX.Element => {
  const [currentPath, setCurrentPath] = useState(readCurrentPath);
  const {
    clearError,
    errorMessage,
    isAuthLoading,
    isLoginSubmitting,
    login,
    logout,
    navigateToHome,
    navigateToLogin,
    token,
    user,
  } = useAuth();
  const { events, isEventsLoading, refreshEvents } = useEvents();
  const previousPathRef = useRef(currentPath);

  useEffect(() => {
    const handlePopState = (): void => {
      setCurrentPath(readCurrentPath());
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (previousPathRef.current === currentPath) {
      return;
    }
    previousPathRef.current = currentPath;
    refreshEvents();
  }, [currentPath, refreshEvents]);

  const openLoginDialog = (): void => {
    clearError();
    navigateToLogin();
  };

  const closeLoginDialog = (): void => {
    navigateToHome();
    clearError();
  };

  const handleLoginSubmit = async (
    credentials: LoginCredentials
  ): Promise<boolean> => {
    const wasSuccessful = await login(credentials);

    if (wasSuccessful) {
      closeLoginDialog();
    }

    return wasSuccessful;
  };

  const isLoginPage = currentPath === "/login";
  const isCreateEventPage = CREATE_EVENT_PATTERN.test(currentPath);
  const isCreateAccountPage = CREATE_ACCOUNT_PATTERN.test(currentPath);
  const eventDetailMatch = EVENT_DETAIL_PATTERN.exec(currentPath);
  const isManageUsersPage = MANAGE_USERS_PATTERN.test(currentPath);
  const manageUserDetailMatch = MANAGE_USER_DETAIL_PATTERN.exec(currentPath);
  const isManageServerPage = MANAGE_SERVER_PATTERN.test(currentPath);
  const isAdminUser = hasAdminGlobalRole(user);
  const editEventMatch = EDIT_EVENT_PATTERN.exec(currentPath);
  const eventDashboardMatch = EVENT_DASHBOARD_PATTERN.exec(currentPath);
  const defaultAccountsMatch = DEFAULT_ACCOUNTS_PATTERN.exec(currentPath);
  const navigateTo = (path: string): void => {
    if (window.location.pathname === path) {
      return;
    }

    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const renderAdminPage = (page: JSX.Element): JSX.Element => {
    if (isAuthLoading) {
      return (
        <main className="page-shell page-shell--center">
          <LoadingIndicator />
        </main>
      );
    }

    if (!isAdminUser) {
      return <RouteErrorPage message="Admin access required." />;
    }

    return page;
  };

  const renderDefaultAccountsPage = (): JSX.Element => {
    if (!defaultAccountsMatch) {
      return (
        <HomePage
          events={events}
          isEventsLoading={isEventsLoading}
          onNavigate={navigateTo}
        />
      );
    }

    const eventCode = decodePathSegment(defaultAccountsMatch[1]);
    if (eventCode === null) {
      return <RouteErrorPage message="Invalid event code in URL." />;
    }
    return <DefaultAccountsPage eventCode={eventCode} token={token} />;
  };

  const renderManageUserDetailPage = (): JSX.Element | null => {
    if (!manageUserDetailMatch) {
      return null;
    }

    const encodedUsername =
      manageUserDetailMatch[1] ?? manageUserDetailMatch[2];
    if (!encodedUsername) {
      return <RouteErrorPage message="Invalid username in URL." />;
    }

    const username = decodePathSegment(encodedUsername);
    if (username === null) {
      return <RouteErrorPage message="Invalid username in URL." />;
    }

    return renderAdminPage(
      <ManageUserPage
        events={events}
        isEventsLoading={isEventsLoading}
        token={token}
        username={username}
      />
    );
  };

  const renderEventDetailPage = (): JSX.Element | null => {
    if (!eventDetailMatch) {
      return null;
    }

    const eventCode = decodePathSegment(eventDetailMatch[1]);
    if (eventCode === null) {
      return <RouteErrorPage message="Invalid event code in URL." />;
    }

    return (
      <EventPage
        eventCode={eventCode}
        events={events}
        isEventsLoading={isEventsLoading}
        user={user}
      />
    );
  };

  const renderAdminRoutePage = (): JSX.Element | null => {
    if (isCreateEventPage) {
      return renderAdminPage(<CreateEventPage token={token} />);
    }

    if (isCreateAccountPage) {
      return renderAdminPage(
        <CreateAccountPage
          events={events}
          isEventsLoading={isEventsLoading}
          token={token}
        />
      );
    }

    if (isManageUsersPage) {
      return renderAdminPage(<ManageUsersPage token={token} />);
    }

    const manageUserDetailPage = renderManageUserDetailPage();
    if (manageUserDetailPage) {
      return manageUserDetailPage;
    }

    if (isManageServerPage) {
      return renderAdminPage(
        <AdminPlaceholderPage
          description="Manage Server page is not implemented yet."
          title="Manage Server"
        />
      );
    }

    if (editEventMatch) {
      const editEventCode = decodePathSegment(editEventMatch[1]);
      if (editEventCode === null) {
        return <RouteErrorPage message="Invalid event code in URL." />;
      }
      return renderAdminPage(
        <EditEventPage eventCode={editEventCode} token={token} />
      );
    }

    if (eventDashboardMatch) {
      const dashboardEventCode = decodePathSegment(eventDashboardMatch[1]);
      if (dashboardEventCode === null) {
        return <RouteErrorPage message="Invalid event code in URL." />;
      }
      return renderAdminPage(
        <EventDashboardPage
          eventCode={dashboardEventCode}
          events={events}
          isEventsLoading={isEventsLoading}
          user={user}
        />
      );
    }

    return null;
  };

  const renderPage = (): JSX.Element => {
    if (isLoginPage) {
      return (
        <LoginForm
          errorMessage={errorMessage}
          isSubmitting={isLoginSubmitting}
          onSubmit={handleLoginSubmit}
        />
      );
    }

    const adminRoutePage = renderAdminRoutePage();
    if (adminRoutePage) {
      return adminRoutePage;
    }

    const eventDetailPage = renderEventDetailPage();
    if (eventDetailPage) {
      return eventDetailPage;
    }

    return renderDefaultAccountsPage();
  };

  return (
    <>
      <AppHeader
        isAuthLoading={isAuthLoading}
        onLoginClick={openLoginDialog}
        onLogoutClick={logout}
        onNavigate={navigateTo}
        showAdminMenu={isAdminUser}
        user={user}
      />
      {renderPage()}
    </>
  );
};

export default App;
