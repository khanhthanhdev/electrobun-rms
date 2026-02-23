import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useAuth } from "../features/auth/hooks/use-auth";
import { useEvents } from "../features/events/hooks/use-events";
import { LoadingIndicator } from "../shared/components/loading-indicator";
import type { AuthUser, LoginCredentials } from "../shared/types/auth";
import type { EventItem } from "../shared/types/event";
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
const PRACTICE_SCHEDULE_PATTERN =
  /^\/event\/([^/]+)\/dashboard\/schedule\/practice\/?$/;
const QUALIFICATION_SCHEDULE_PATTERN =
  /^\/event\/([^/]+)\/dashboard\/schedule\/quals\/?$/;
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
const INSPECTION_TEAMS_PATTERN = /^\/event\/([^/]+)\/inspection\/?$/;
const INSPECTION_DETAIL_PATTERN = /^\/event\/([^/]+)\/inspection\/(\d+)\/?$/;
const INSPECTION_NOTES_PATTERN = /^\/event\/([^/]+)\/inspection\/notes\/?$/;
const INSPECTION_EVENT_OVERRIDE_PATTERN =
  /^\/event\/([^/]+)\/inspection\/override\/?$/;

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
const PracticeSchedulePage = lazy(() =>
  import("../pages/events/schedule/practice-schedule-page").then((module) => ({
    default: module.PracticeSchedulePage,
  }))
);
const QualificationSchedulePage = lazy(() =>
  import("../pages/events/schedule/qualification-schedule-page").then(
    (module) => ({
      default: module.QualificationSchedulePage,
    })
  )
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
const InspectionDetailPage = lazy(() =>
  import("../pages/events/inspection/inspection-detail-page").then(
    (module) => ({
      default: module.InspectionDetailPage,
    })
  )
);
const InspectionEventOverridePage = lazy(() =>
  import("../pages/events/inspection/inspection-event-override-page").then(
    (module) => ({
      default: module.InspectionEventOverridePage,
    })
  )
);
const InspectionNotesPage = lazy(() =>
  import("../pages/events/inspection/inspection-notes-page").then((module) => ({
    default: module.InspectionNotesPage,
  }))
);
const InspectionTeamsPage = lazy(() =>
  import("../pages/events/inspection/inspection-teams-page").then((module) => ({
    default: module.InspectionTeamsPage,
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

interface AdminGuardProps {
  children: JSX.Element;
  isAdminUser: boolean;
  isAuthLoading: boolean;
}

const AdminGuard = ({
  children,
  isAdminUser,
  isAuthLoading,
}: AdminGuardProps): JSX.Element => {
  if (isAuthLoading) {
    return <PageLoadingFallback />;
  }

  if (!isAdminUser) {
    return <RouteErrorPage message="Admin access required." />;
  }

  return children;
};

interface DefaultAccountsRoutePageProps {
  defaultAccountsMatch: RegExpExecArray | null;
  events: EventItem[];
  isEventsLoading: boolean;
  onNavigate: (path: string) => void;
  token: string | null;
}

const DefaultAccountsRoutePage = ({
  defaultAccountsMatch,
  events,
  isEventsLoading,
  onNavigate,
  token,
}: DefaultAccountsRoutePageProps): JSX.Element => {
  if (!defaultAccountsMatch) {
    return (
      <HomePage
        events={events}
        isEventsLoading={isEventsLoading}
        onNavigate={onNavigate}
      />
    );
  }

  const eventCode = decodePathSegment(defaultAccountsMatch[1]);
  if (eventCode === null) {
    return <RouteErrorPage message="Invalid event code in URL." />;
  }

  return <DefaultAccountsPage eventCode={eventCode} token={token} />;
};

interface ManageUserDetailRoutePageProps {
  events: EventItem[];
  isAdminUser: boolean;
  isAuthLoading: boolean;
  isEventsLoading: boolean;
  manageUserDetailMatch: RegExpExecArray;
  token: string | null;
}

const ManageUserDetailRoutePage = ({
  events,
  isAdminUser,
  isAuthLoading,
  isEventsLoading,
  manageUserDetailMatch,
  token,
}: ManageUserDetailRoutePageProps): JSX.Element => {
  const encodedUsername = manageUserDetailMatch[1] ?? manageUserDetailMatch[2];
  if (!encodedUsername) {
    return <RouteErrorPage message="Invalid username in URL." />;
  }

  const username = decodePathSegment(encodedUsername);
  if (username === null) {
    return <RouteErrorPage message="Invalid username in URL." />;
  }

  return (
    <AdminGuard isAdminUser={isAdminUser} isAuthLoading={isAuthLoading}>
      <ManageUserPage
        events={events}
        isEventsLoading={isEventsLoading}
        token={token}
        username={username}
      />
    </AdminGuard>
  );
};

interface EventDetailRoutePageProps {
  eventDetailMatch: RegExpExecArray;
  events: EventItem[];
  isEventsLoading: boolean;
  user: AuthUser | null;
}

const EventDetailRoutePage = ({
  eventDetailMatch,
  events,
  isEventsLoading,
  user,
}: EventDetailRoutePageProps): JSX.Element => {
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

type EventScopedAdminRouteResolution =
  | {
      eventCode: string;
      kind: "allowed";
    }
  | {
      kind: "blocked";
      page: JSX.Element;
    };

interface ResolveEventScopedAdminRouteArgs {
  encodedEventCode: string | undefined;
  isAuthLoading: boolean;
  user: AuthUser | null;
}

const resolveEventScopedAdminRoute = ({
  encodedEventCode,
  isAuthLoading,
  user,
}: ResolveEventScopedAdminRouteArgs): EventScopedAdminRouteResolution => {
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
      page: <PageLoadingFallback />,
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

const resolveEventScopedAdminMatch = (
  match: RegExpExecArray | null,
  isAuthLoading: boolean,
  user: AuthUser | null
): EventScopedAdminRouteResolution | null => {
  if (!match) {
    return null;
  }

  return resolveEventScopedAdminRoute({
    encodedEventCode: match[1],
    isAuthLoading,
    user,
  });
};

const renderEventScopedAdminRoute = (
  routeResolution: EventScopedAdminRouteResolution,
  renderAllowedPage: (eventCode: string) => JSX.Element
): JSX.Element =>
  routeResolution.kind === "blocked"
    ? routeResolution.page
    : renderAllowedPage(routeResolution.eventCode);

interface EventScopedAdminRoutesPageProps {
  defaultAccountsMatch: RegExpExecArray | null;
  editEventMatch: RegExpExecArray | null;
  eventDashboardMatch: RegExpExecArray | null;
  eventReportsMatch: RegExpExecArray | null;
  events: EventItem[];
  eventTeamsMatch: RegExpExecArray | null;
  isAuthLoading: boolean;
  isEventsLoading: boolean;
  practiceScheduleMatch: RegExpExecArray | null;
  qualificationScheduleMatch: RegExpExecArray | null;
  token: string | null;
  user: AuthUser | null;
}

const EventScopedAdminRoutesPage = ({
  defaultAccountsMatch,
  editEventMatch,
  eventDashboardMatch,
  eventReportsMatch,
  eventTeamsMatch,
  practiceScheduleMatch,
  qualificationScheduleMatch,
  events,
  isAuthLoading,
  isEventsLoading,
  token,
  user,
}: EventScopedAdminRoutesPageProps): JSX.Element | null => {
  const editRouteResolution = resolveEventScopedAdminMatch(
    editEventMatch,
    isAuthLoading,
    user
  );
  if (editRouteResolution) {
    return renderEventScopedAdminRoute(
      editRouteResolution,
      (resolvedEventCode) => (
        <EditEventPage eventCode={resolvedEventCode} token={token} />
      )
    );
  }

  const dashboardRouteResolution = resolveEventScopedAdminMatch(
    eventDashboardMatch,
    isAuthLoading,
    user
  );
  if (dashboardRouteResolution) {
    return renderEventScopedAdminRoute(
      dashboardRouteResolution,
      (resolvedEventCode) => (
        <EventDashboardPage
          eventCode={resolvedEventCode}
          events={events}
          isEventsLoading={isEventsLoading}
          user={user}
        />
      )
    );
  }

  const reportsRouteResolution = resolveEventScopedAdminMatch(
    eventReportsMatch,
    isAuthLoading,
    user
  );
  if (reportsRouteResolution) {
    return renderEventScopedAdminRoute(
      reportsRouteResolution,
      (resolvedEventCode) => (
        <EventReportsPage eventCode={resolvedEventCode} token={token} />
      )
    );
  }

  const teamsRouteResolution = resolveEventScopedAdminMatch(
    eventTeamsMatch,
    isAuthLoading,
    user
  );
  if (teamsRouteResolution) {
    return renderEventScopedAdminRoute(
      teamsRouteResolution,
      (resolvedEventCode) => (
        <TeamsPage eventCode={resolvedEventCode} token={token} />
      )
    );
  }

  const scheduleMatch = practiceScheduleMatch ?? qualificationScheduleMatch;
  const scheduleRouteResolution = resolveEventScopedAdminMatch(
    scheduleMatch,
    isAuthLoading,
    user
  );
  if (scheduleRouteResolution) {
    return renderEventScopedAdminRoute(
      scheduleRouteResolution,
      (resolvedEventCode) =>
        practiceScheduleMatch ? (
          <PracticeSchedulePage eventCode={resolvedEventCode} token={token} />
        ) : (
          <QualificationSchedulePage
            eventCode={resolvedEventCode}
            token={token}
          />
        )
    );
  }

  const defaultAccountsRouteResolution = resolveEventScopedAdminMatch(
    defaultAccountsMatch,
    isAuthLoading,
    user
  );
  if (defaultAccountsRouteResolution) {
    return renderEventScopedAdminRoute(
      defaultAccountsRouteResolution,
      (resolvedEventCode) => (
        <DefaultAccountsPage eventCode={resolvedEventCode} token={token} />
      )
    );
  }

  return null;
};

interface AdminRoutesPageProps {
  defaultAccountsMatch: RegExpExecArray | null;
  editEventMatch: RegExpExecArray | null;
  eventDashboardMatch: RegExpExecArray | null;
  eventReportsMatch: RegExpExecArray | null;
  events: EventItem[];
  eventTeamsMatch: RegExpExecArray | null;
  isAdminUser: boolean;
  isAuthLoading: boolean;
  isCreateAccountPage: boolean;
  isCreateEventPage: boolean;
  isEventsLoading: boolean;
  isManageServerPage: boolean;
  isManageUsersPage: boolean;
  manageUserDetailMatch: RegExpExecArray | null;
  practiceScheduleMatch: RegExpExecArray | null;
  qualificationScheduleMatch: RegExpExecArray | null;
  token: string | null;
  user: AuthUser | null;
}

const AdminRoutesPage = ({
  defaultAccountsMatch,
  editEventMatch,
  eventDashboardMatch,
  eventReportsMatch,
  eventTeamsMatch,
  practiceScheduleMatch,
  qualificationScheduleMatch,
  events,
  isAdminUser,
  isAuthLoading,
  isCreateAccountPage,
  isCreateEventPage,
  isEventsLoading,
  isManageServerPage,
  isManageUsersPage,
  manageUserDetailMatch,
  token,
  user,
}: AdminRoutesPageProps): JSX.Element | null => {
  if (isCreateEventPage) {
    return (
      <AdminGuard isAdminUser={isAdminUser} isAuthLoading={isAuthLoading}>
        <CreateEventPage token={token} />
      </AdminGuard>
    );
  }

  if (isCreateAccountPage) {
    return (
      <AdminGuard isAdminUser={isAdminUser} isAuthLoading={isAuthLoading}>
        <CreateAccountPage
          events={events}
          isEventsLoading={isEventsLoading}
          token={token}
        />
      </AdminGuard>
    );
  }

  if (isManageUsersPage) {
    return (
      <AdminGuard isAdminUser={isAdminUser} isAuthLoading={isAuthLoading}>
        <ManageUsersPage token={token} />
      </AdminGuard>
    );
  }

  if (manageUserDetailMatch) {
    return (
      <ManageUserDetailRoutePage
        events={events}
        isAdminUser={isAdminUser}
        isAuthLoading={isAuthLoading}
        isEventsLoading={isEventsLoading}
        manageUserDetailMatch={manageUserDetailMatch}
        token={token}
      />
    );
  }

  if (isManageServerPage) {
    return (
      <AdminGuard isAdminUser={isAdminUser} isAuthLoading={isAuthLoading}>
        <AdminPlaceholderPage
          description="Manage Server page is not implemented yet."
          title="Manage Server"
        />
      </AdminGuard>
    );
  }

  return (
    <EventScopedAdminRoutesPage
      defaultAccountsMatch={defaultAccountsMatch}
      editEventMatch={editEventMatch}
      eventDashboardMatch={eventDashboardMatch}
      eventReportsMatch={eventReportsMatch}
      events={events}
      eventTeamsMatch={eventTeamsMatch}
      isAuthLoading={isAuthLoading}
      isEventsLoading={isEventsLoading}
      practiceScheduleMatch={practiceScheduleMatch}
      qualificationScheduleMatch={qualificationScheduleMatch}
      token={token}
      user={user}
    />
  );
};

interface AppRouteContentProps {
  currentPath: string;
  errorMessage: string | null;
  events: EventItem[];
  handleLoginSubmit: (credentials: LoginCredentials) => Promise<boolean>;
  isAdminUser: boolean;
  isAuthLoading: boolean;
  isEventsLoading: boolean;
  isLoginSubmitting: boolean;
  onNavigate: (path: string) => void;
  token: string | null;
  user: AuthUser | null;
}

const AppRouteContent = ({
  currentPath,
  errorMessage,
  events,
  handleLoginSubmit,
  isAdminUser,
  isAuthLoading,
  isEventsLoading,
  isLoginSubmitting,
  onNavigate,
  token,
  user,
}: AppRouteContentProps): JSX.Element => {
  if (currentPath === "/login") {
    return (
      <LoginForm
        errorMessage={errorMessage}
        isSubmitting={isLoginSubmitting}
        onSubmit={handleLoginSubmit}
      />
    );
  }

  const isCreateEventPage = CREATE_EVENT_PATTERN.test(currentPath);
  const isCreateAccountPage = CREATE_ACCOUNT_PATTERN.test(currentPath);
  const isManageUsersPage = MANAGE_USERS_PATTERN.test(currentPath);
  const isManageServerPage = MANAGE_SERVER_PATTERN.test(currentPath);

  const manageUserDetailMatch = MANAGE_USER_DETAIL_PATTERN.exec(currentPath);
  const editEventMatch = EDIT_EVENT_PATTERN.exec(currentPath);
  const eventDashboardMatch = EVENT_DASHBOARD_PATTERN.exec(currentPath);
  const eventReportsMatch = EVENT_REPORTS_PATTERN.exec(currentPath);
  const eventTeamsMatch = EVENT_TEAMS_PATTERN.exec(currentPath);
  const practiceScheduleMatch = PRACTICE_SCHEDULE_PATTERN.exec(currentPath);
  const qualificationScheduleMatch =
    QUALIFICATION_SCHEDULE_PATTERN.exec(currentPath);
  const eventDetailMatch = EVENT_DETAIL_PATTERN.exec(currentPath);
  const defaultAccountsMatch = DEFAULT_ACCOUNTS_PATTERN.exec(currentPath);
  const inspectionTeamsMatch = INSPECTION_TEAMS_PATTERN.exec(currentPath);
  const inspectionNotesMatch = INSPECTION_NOTES_PATTERN.exec(currentPath);
  const inspectionDetailMatch = INSPECTION_DETAIL_PATTERN.exec(currentPath);
  const inspectionEventOverrideMatch =
    INSPECTION_EVENT_OVERRIDE_PATTERN.exec(currentPath);

  const hasAdminRoute =
    isCreateEventPage ||
    isCreateAccountPage ||
    isManageUsersPage ||
    Boolean(manageUserDetailMatch) ||
    isManageServerPage ||
    Boolean(editEventMatch) ||
    Boolean(eventDashboardMatch) ||
    Boolean(eventReportsMatch) ||
    Boolean(eventTeamsMatch) ||
    Boolean(practiceScheduleMatch) ||
    Boolean(qualificationScheduleMatch) ||
    Boolean(defaultAccountsMatch);

  if (hasAdminRoute) {
    return (
      <AdminRoutesPage
        defaultAccountsMatch={defaultAccountsMatch}
        editEventMatch={editEventMatch}
        eventDashboardMatch={eventDashboardMatch}
        eventReportsMatch={eventReportsMatch}
        events={events}
        eventTeamsMatch={eventTeamsMatch}
        isAdminUser={isAdminUser}
        isAuthLoading={isAuthLoading}
        isCreateAccountPage={isCreateAccountPage}
        isCreateEventPage={isCreateEventPage}
        isEventsLoading={isEventsLoading}
        isManageServerPage={isManageServerPage}
        isManageUsersPage={isManageUsersPage}
        manageUserDetailMatch={manageUserDetailMatch}
        practiceScheduleMatch={practiceScheduleMatch}
        qualificationScheduleMatch={qualificationScheduleMatch}
        token={token}
        user={user}
      />
    );
  }

  if (inspectionEventOverrideMatch) {
    const eventCode = decodePathSegment(inspectionEventOverrideMatch[1]);
    if (eventCode === null) {
      return <RouteErrorPage message="Invalid event code in URL." />;
    }
    return (
      <InspectionEventOverridePage
        eventCode={eventCode}
        onNavigate={onNavigate}
        token={token}
      />
    );
  }

  if (inspectionNotesMatch) {
    const eventCode = decodePathSegment(inspectionNotesMatch[1]);
    if (eventCode === null) {
      return <RouteErrorPage message="Invalid event code in URL." />;
    }
    return (
      <InspectionNotesPage
        eventCode={eventCode}
        onNavigate={onNavigate}
        token={token}
      />
    );
  }

  if (inspectionDetailMatch) {
    const eventCode = decodePathSegment(inspectionDetailMatch[1]);
    const teamNumber = Number.parseInt(inspectionDetailMatch[2], 10);
    if (eventCode === null || !Number.isInteger(teamNumber)) {
      return <RouteErrorPage message="Invalid inspection URL." />;
    }
    return (
      <InspectionDetailPage
        eventCode={eventCode}
        onNavigate={onNavigate}
        teamNumber={teamNumber}
        token={token}
      />
    );
  }

  if (inspectionTeamsMatch) {
    const eventCode = decodePathSegment(inspectionTeamsMatch[1]);
    if (eventCode === null) {
      return <RouteErrorPage message="Invalid event code in URL." />;
    }
    return (
      <InspectionTeamsPage
        eventCode={eventCode}
        onNavigate={onNavigate}
        token={token}
      />
    );
  }

  if (eventDetailMatch) {
    return (
      <EventDetailRoutePage
        eventDetailMatch={eventDetailMatch}
        events={events}
        isEventsLoading={isEventsLoading}
        user={user}
      />
    );
  }

  return (
    <DefaultAccountsRoutePage
      defaultAccountsMatch={defaultAccountsMatch}
      events={events}
      isEventsLoading={isEventsLoading}
      onNavigate={onNavigate}
      token={token}
    />
  );
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

  const navigateTo = (path: string): void => {
    if (window.location.pathname === path) {
      return;
    }

    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const isAdminUser = hasAdminGlobalRole(user);

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
        <AppRouteContent
          currentPath={currentPath}
          errorMessage={errorMessage}
          events={events}
          handleLoginSubmit={handleLoginSubmit}
          isAdminUser={isAdminUser}
          isAuthLoading={isAuthLoading}
          isEventsLoading={isEventsLoading}
          isLoginSubmitting={isLoginSubmitting}
          onNavigate={navigateTo}
          token={token}
          user={user}
        />
      </Suspense>
    </>
  );
};

export default App;
