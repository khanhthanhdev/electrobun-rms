import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useAuth } from "../features/auth/hooks/use-auth";
import { useEvents } from "../features/events/hooks/use-events";
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
const EVENT_REPORTS_PATTERN = /^\/event\/([^/]+)\/dashboard\/reports\/?$/;
const EVENT_TEAMS_PATTERN = /^\/event\/([^/]+)\/dashboard\/teams\/?$/;
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

const LoginForm = lazy(() =>
  import("../features/auth/components/login-dialog").then((module) => ({
    default: module.LoginForm,
  }))
);
const AdminPlaceholderPage = lazy(() =>
  import("../pages/admin/admin-placeholder-page").then((module) => ({
    default: module.AdminPlaceholderPage,
  }))
);
const CreateEventPage = lazy(() =>
  import("../pages/events/create-event-page").then((module) => ({
    default: module.CreateEventPage,
  }))
);
const DefaultAccountsPage = lazy(() =>
  import("../pages/events/default-accounts-page").then((module) => ({
    default: module.DefaultAccountsPage,
  }))
);
const EditEventPage = lazy(() =>
  import("../pages/events/edit-event-page").then((module) => ({
    default: module.EditEventPage,
  }))
);
const EventDashboardPage = lazy(() =>
  import("../pages/events/event-dashboard-page").then((module) => ({
    default: module.EventDashboardPage,
  }))
);
const EventPage = lazy(() =>
  import("../pages/events/event-page").then((module) => ({
    default: module.EventPage,
  }))
);
const EventReportsPage = lazy(() =>
  import("../pages/events/event-reports-page").then((module) => ({
    default: module.EventReportsPage,
  }))
);
const TeamsPage = lazy(() =>
  import("../pages/events/teams-page").then((module) => ({
    default: module.TeamsPage,
  }))
);
const HomePage = lazy(() =>
  import("../pages/home/home-page").then((module) => ({
    default: module.HomePage,
  }))
);
const CreateAccountPage = lazy(() =>
  import("../pages/users/create-account-page").then((module) => ({
    default: module.CreateAccountPage,
  }))
);
const ManageUserPage = lazy(() =>
  import("../pages/users/manage-user-page").then((module) => ({
    default: module.ManageUserPage,
  }))
);
const ManageUsersPage = lazy(() =>
  import("../pages/users/manage-users-page").then((module) => ({
    default: module.ManageUsersPage,
  }))
);

const hasAdminGlobalRole = (user: AuthUser | null): boolean =>
  Boolean(
    user?.roles.some((role) => role.role === "ADMIN" && role.event === "*")
  );

const hasEventAdminRole = (user: AuthUser | null, eventCode: string): boolean =>
  Boolean(
    user?.roles.some(
      (role) =>
        role.role === "ADMIN" &&
        (role.event === "*" || role.event === eventCode)
    )
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

const PageLoadingFallback = (): JSX.Element => (
  <main className="page-shell page-shell--center">
    <LoadingIndicator />
  </main>
);

interface AppPageContentProps {
  errorMessage: string | null;
  handleLoginSubmit: (credentials: LoginCredentials) => Promise<boolean>;
  isLoginPage: boolean;
  isLoginSubmitting: boolean;
  renderAdminRoutePage: () => JSX.Element | null;
  renderDefaultAccountsPage: () => JSX.Element;
  renderEventDetailPage: () => JSX.Element | null;
}

const AppPageContent = ({
  errorMessage,
  handleLoginSubmit,
  isLoginPage,
  isLoginSubmitting,
  renderAdminRoutePage,
  renderDefaultAccountsPage,
  renderEventDetailPage,
}: AppPageContentProps): JSX.Element => {
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

type EventScopedAdminRouteResolution =
  | {
      eventCode: string;
      kind: "allowed";
    }
  | {
      kind: "blocked";
      page: JSX.Element;
    };

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
  const eventReportsMatch = EVENT_REPORTS_PATTERN.exec(currentPath);
  const eventTeamsMatch = EVENT_TEAMS_PATTERN.exec(currentPath);
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

  const resolveEventScopedAdminRoute = (
    encodedEventCode: string | undefined
  ): EventScopedAdminRouteResolution => {
    if (!encodedEventCode) {
      return {
        kind: "blocked",
        page: <RouteErrorPage message="Invalid event code in URL." />,
      };
    }

    const decodedEventCode = decodePathSegment(encodedEventCode);
    if (decodedEventCode === null) {
      return {
        kind: "blocked",
        page: <RouteErrorPage message="Invalid event code in URL." />,
      };
    }

    if (isAuthLoading) {
      return {
        kind: "blocked",
        page: (
          <main className="page-shell page-shell--center">
            <LoadingIndicator />
          </main>
        ),
      };
    }

    if (!hasEventAdminRole(user, decodedEventCode)) {
      return {
        kind: "blocked",
        page: (
          <RouteErrorPage
            message={`Admin access for event "${decodedEventCode}" is required.`}
          />
        ),
      };
    }

    return {
      eventCode: decodedEventCode,
      kind: "allowed",
    };
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

  const renderEventScopedAdminRoutePage = (): JSX.Element | null => {
    if (editEventMatch) {
      const routeResolution = resolveEventScopedAdminRoute(editEventMatch[1]);
      if (routeResolution.kind === "blocked") {
        return routeResolution.page;
      }
      return (
        <EditEventPage eventCode={routeResolution.eventCode} token={token} />
      );
    }

    if (eventDashboardMatch) {
      const routeResolution = resolveEventScopedAdminRoute(
        eventDashboardMatch[1]
      );
      if (routeResolution.kind === "blocked") {
        return routeResolution.page;
      }
      return (
        <EventDashboardPage
          eventCode={routeResolution.eventCode}
          events={events}
          isEventsLoading={isEventsLoading}
          user={user}
        />
      );
    }

    if (eventReportsMatch) {
      const routeResolution = resolveEventScopedAdminRoute(
        eventReportsMatch[1]
      );
      if (routeResolution.kind === "blocked") {
        return routeResolution.page;
      }
      return (
        <EventReportsPage eventCode={routeResolution.eventCode} token={token} />
      );
    }

    if (eventTeamsMatch) {
      const routeResolution = resolveEventScopedAdminRoute(eventTeamsMatch[1]);
      if (routeResolution.kind === "blocked") {
        return routeResolution.page;
      }
      return <TeamsPage eventCode={routeResolution.eventCode} token={token} />;
    }

    return null;
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
    return renderEventScopedAdminRoutePage();
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
      <Suspense fallback={<PageLoadingFallback />}>
        <AppPageContent
          errorMessage={errorMessage}
          handleLoginSubmit={handleLoginSubmit}
          isLoginPage={isLoginPage}
          isLoginSubmitting={isLoginSubmitting}
          renderAdminRoutePage={renderAdminRoutePage}
          renderDefaultAccountsPage={renderDefaultAccountsPage}
          renderEventDetailPage={renderEventDetailPage}
        />
      </Suspense>
    </>
  );
};

export default App;
