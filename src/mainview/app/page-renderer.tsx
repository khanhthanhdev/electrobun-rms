import { lazy } from "react";
import { LoadingIndicator } from "@/shared/components/loading-indicator";
import type { AuthUser, LoginCredentials } from "@/shared/types/auth";
import type { EventItem } from "@/shared/types/event";

const EDIT_EVENT_PATTERN = /^\/event\/([^/]+)\/edit\/?$/;
const EVENT_DASHBOARD_PATTERN = /^\/event\/([^/]+)\/dashboard\/?$/;
const EVENT_CONTROL_PATTERN = /^\/event\/([^/]+)\/control\/?$/;
const EVENT_REPORTS_PATTERN = /^\/event\/([^/]+)\/dashboard\/reports\/?$/;
const EVENT_TEAMS_PATTERN = /^\/event\/([^/]+)\/dashboard\/teams\/?$/;
const PRACTICE_SCHEDULE_PATTERN =
  /^\/event\/([^/]+)\/dashboard\/schedule\/practice\/?$/;
const QUALIFICATION_SCHEDULE_PATTERN =
  /^\/event\/([^/]+)\/dashboard\/schedule\/quals\/?$/;
const PUBLIC_PRACTICE_SCHEDULE_PATTERN = /^\/event\/([^/]+)\/practice\/?$/;
const PUBLIC_QUALIFICATION_SCHEDULE_PATTERN = /^\/event\/([^/]+)\/qual\/?$/;
const PUBLIC_QUALIFICATION_RANKINGS_PATTERN =
  /^\/event\/([^/]+)\/qualification\/rankings\/?$/;
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
const REFEREE_RED_SCORING_PATTERN =
  /^\/event\/([^/]+)\/ref\/red\/scoring(?:\/([^/]+))?\/?$/;
const REFEREE_BLUE_SCORING_PATTERN =
  /^\/event\/([^/]+)\/ref\/blue\/scoring(?:\/([^/]+))?\/?$/;
const HEAD_REFEREE_PATTERN = /^\/event\/([^/]+)\/hr(?:\/([^/]+))?\/?$/;
const REFEREE_RED_SCORE_ENTRY_PATTERN =
  /^\/event\/([^/]+)\/ref\/red\/scoring\/([^/]+)\/match\/(\d+)\/?$/;
const REFEREE_BLUE_SCORE_ENTRY_PATTERN =
  /^\/event\/([^/]+)\/ref\/blue\/scoring\/([^/]+)\/match\/(\d+)\/?$/;
const HEAD_REFEREE_MATCH_PATTERN =
  /^\/event\/([^/]+)\/hr\/([^/]+)\/match\/(\d+)\/?$/;
const MATCH_RESULTS_PATTERN = /^\/event\/([^/]+)\/results\/?$/;
const MATCH_HISTORY_PATTERN = /^\/event\/([^/]+)\/match\/([^/]+)\/history\/?$/;
const MATCH_SCORESHEET_PATTERN = /^\/event\/([^/]+)\/match\/([^/]+)\/?$/;
const MATCH_ALLIANCE_SCORESHEET_PATTERN =
  /^\/event\/([^/]+)\/match\/([^/]+)\/(red|blue)\/?$/;

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
const EventControlPage = lazy(() =>
  import("../pages/events/control/event-control-page").then((module) => ({
    default: module.EventControlPage,
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
const PracticeScheduleViewPage = lazy(() =>
  import("../pages/events/schedule/practice-schedule-view-page").then(
    (module) => ({
      default: module.PracticeScheduleViewPage,
    })
  )
);
const QualificationScheduleViewPage = lazy(() =>
  import("../pages/events/schedule/qualification-schedule-view-page").then(
    (module) => ({
      default: module.QualificationScheduleViewPage,
    })
  )
);
const QualificationRankingsViewPage = lazy(() =>
  import("../pages/events/ranking/qualification-rankings-view-page").then(
    (module) => ({
      default: module.QualificationRankingsViewPage,
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
const RefereeSelectionPage = lazy(() =>
  import("../pages/events/referee/referee-selection-page").then((module) => ({
    default: module.RefereeSelectionPage,
  }))
);
const MatchSelectionPage = lazy(() =>
  import("../pages/events/referee/match-selection-page").then((module) => ({
    default: module.MatchSelectionPage,
  }))
);
const ScoringEntryPage = lazy(() =>
  import("../pages/events/referee/scoring-entry-page").then((module) => ({
    default: module.ScoringEntryPage,
  }))
);
const HrMatchPage = lazy(() =>
  import("../pages/events/referee/hr-match-page").then((module) => ({
    default: module.HrMatchPage,
  }))
);
const HeadRefereePage = lazy(() =>
  import("../pages/events/referee/head-referee-page").then((module) => ({
    default: module.HeadRefereePage,
  }))
);
const MatchResultsPage = lazy(() =>
  import("../pages/events/results/match-results-page").then((module) => ({
    default: module.MatchResultsPage,
  }))
);
const MatchHistoryPage = lazy(() =>
  import("../pages/events/results/match-history-page").then((module) => ({
    default: module.MatchHistoryPage,
  }))
);
const MatchScoresheetPage = lazy(() =>
  import("../pages/events/results/match-scoresheet-page").then((module) => ({
    default: module.MatchScoresheetPage,
  }))
);

export const hasAdminGlobalRole = (user: AuthUser | null): boolean =>
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

export const PageLoadingFallback = (): JSX.Element => (
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
  eventControlMatch: RegExpExecArray | null;
  eventDashboardMatch: RegExpExecArray | null;
  eventReportsMatch: RegExpExecArray | null;
  events: EventItem[];
  eventTeamsMatch: RegExpExecArray | null;
  isAuthLoading: boolean;
  isEventsLoading: boolean;
  onNavigate: (path: string) => void;
  practiceScheduleMatch: RegExpExecArray | null;
  qualificationScheduleMatch: RegExpExecArray | null;
  token: string | null;
  user: AuthUser | null;
}

const EventScopedAdminRoutesPage = ({
  eventControlMatch,
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
  onNavigate,
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

  const controlRouteResolution = resolveEventScopedAdminMatch(
    eventControlMatch,
    isAuthLoading,
    user
  );
  if (controlRouteResolution) {
    return renderEventScopedAdminRoute(
      controlRouteResolution,
      (resolvedEventCode) => (
        <EventControlPage
          eventCode={resolvedEventCode}
          onNavigate={onNavigate}
          token={token}
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
  eventControlMatch: RegExpExecArray | null;
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
  onNavigate: (path: string) => void;
  practiceScheduleMatch: RegExpExecArray | null;
  qualificationScheduleMatch: RegExpExecArray | null;
  token: string | null;
  user: AuthUser | null;
}

const AdminRoutesPage = ({
  eventControlMatch,
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
  onNavigate,
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
      eventControlMatch={eventControlMatch}
      eventDashboardMatch={eventDashboardMatch}
      eventReportsMatch={eventReportsMatch}
      events={events}
      eventTeamsMatch={eventTeamsMatch}
      isAuthLoading={isAuthLoading}
      isEventsLoading={isEventsLoading}
      onNavigate={onNavigate}
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

interface PublicScheduleRoutePageArgs {
  publicPracticeScheduleMatch: RegExpExecArray | null;
  publicQualificationScheduleMatch: RegExpExecArray | null;
  token: string | null;
}

const renderPublicScheduleRoutePage = ({
  publicPracticeScheduleMatch,
  publicQualificationScheduleMatch,
  token,
}: PublicScheduleRoutePageArgs): JSX.Element | null => {
  const publicScheduleMatch =
    publicPracticeScheduleMatch ?? publicQualificationScheduleMatch;
  if (!publicScheduleMatch) {
    return null;
  }

  const eventCode = decodePathSegment(publicScheduleMatch[1]);
  if (eventCode === null) {
    return <RouteErrorPage message="Invalid event code in URL." />;
  }

  return publicPracticeScheduleMatch ? (
    <PracticeScheduleViewPage eventCode={eventCode} token={token} />
  ) : (
    <QualificationScheduleViewPage eventCode={eventCode} token={token} />
  );
};

interface PublicQualificationRankingsRoutePageArgs {
  publicQualificationRankingsMatch: RegExpExecArray | null;
  token: string | null;
}

const renderPublicQualificationRankingsRoutePage = ({
  publicQualificationRankingsMatch,
  token,
}: PublicQualificationRankingsRoutePageArgs): JSX.Element | null => {
  if (!publicQualificationRankingsMatch) {
    return null;
  }

  const eventCode = decodePathSegment(publicQualificationRankingsMatch[1]);
  if (eventCode === null) {
    return <RouteErrorPage message="Invalid event code in URL." />;
  }

  return <QualificationRankingsViewPage eventCode={eventCode} token={token} />;
};

interface InspectionRoutePageArgs {
  inspectionDetailMatch: RegExpExecArray | null;
  inspectionEventOverrideMatch: RegExpExecArray | null;
  inspectionNotesMatch: RegExpExecArray | null;
  inspectionTeamsMatch: RegExpExecArray | null;
  onNavigate: (path: string) => void;
  token: string | null;
}

const renderInspectionRoutePage = ({
  inspectionDetailMatch,
  inspectionEventOverrideMatch,
  inspectionNotesMatch,
  inspectionTeamsMatch,
  onNavigate,
  token,
}: InspectionRoutePageArgs): JSX.Element | null => {
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

  return null;
};

interface RefereeRoutePageArgs {
  events: EventItem[];
  headRefereeMatch: RegExpExecArray | null;
  headRefereeMatchEntryMatch: RegExpExecArray | null;
  isEventsLoading: boolean;
  onNavigate: (path: string) => void;
  refereeBlueScoreEntryMatch: RegExpExecArray | null;
  refereeBlueScoringMatch: RegExpExecArray | null;
  refereeRedScoreEntryMatch: RegExpExecArray | null;
  refereeRedScoringMatch: RegExpExecArray | null;
  token: string | null;
}

const renderScoringEntryPage = (
  match: RegExpExecArray,
  alliance: "blue" | "red",
  onNavigate: (path: string) => void
): JSX.Element | null => {
  const eventCode = decodePathSegment(match[1]);
  const fieldNumber = match[2] ? decodePathSegment(match[2]) : null;
  const matchNumber = Number.parseInt(match[3], 10);
  if (
    eventCode === null ||
    fieldNumber === null ||
    !Number.isInteger(matchNumber)
  ) {
    return <RouteErrorPage message="Invalid scoring URL." />;
  }
  return (
    <ScoringEntryPage
      alliance={alliance}
      eventCode={eventCode}
      fieldNumber={fieldNumber}
      matchNumber={matchNumber}
      onNavigate={onNavigate}
    />
  );
};

const renderHrMatchEntryPage = (
  match: RegExpExecArray,
  onNavigate: (path: string) => void
): JSX.Element | null => {
  const eventCode = decodePathSegment(match[1]);
  const fieldNumber = match[2] ? decodePathSegment(match[2]) : null;
  const matchNumber = Number.parseInt(match[3], 10);
  if (
    eventCode === null ||
    fieldNumber === null ||
    !Number.isInteger(matchNumber)
  ) {
    return <RouteErrorPage message="Invalid HR match URL." />;
  }
  return (
    <HrMatchPage
      eventCode={eventCode}
      fieldNumber={fieldNumber}
      matchNumber={matchNumber}
      onNavigate={onNavigate}
    />
  );
};

const renderRefereeRoutePage = ({
  refereeRedScoringMatch,
  refereeRedScoreEntryMatch,
  refereeBlueScoringMatch,
  refereeBlueScoreEntryMatch,
  headRefereeMatch,
  headRefereeMatchEntryMatch,
  events,
  isEventsLoading,
  onNavigate,
  token,
}: RefereeRoutePageArgs): JSX.Element | null => {
  if (refereeRedScoreEntryMatch) {
    return renderScoringEntryPage(refereeRedScoreEntryMatch, "red", onNavigate);
  }

  if (refereeBlueScoreEntryMatch) {
    return renderScoringEntryPage(
      refereeBlueScoreEntryMatch,
      "blue",
      onNavigate
    );
  }

  if (headRefereeMatchEntryMatch) {
    return renderHrMatchEntryPage(headRefereeMatchEntryMatch, onNavigate);
  }

  // Head Referee gets its own tabbed page when a field is selected
  if (headRefereeMatch) {
    const hrEventCode = decodePathSegment(headRefereeMatch[1]);
    if (hrEventCode === null) {
      return <RouteErrorPage message="Invalid event code in URL." />;
    }
    const hrFieldSelection = headRefereeMatch[2]
      ? decodePathSegment(headRefereeMatch[2])
      : null;

    if (hrFieldSelection) {
      return (
        <HeadRefereePage
          eventCode={hrEventCode}
          fieldNumber={hrFieldSelection}
          onNavigate={onNavigate}
          token={token}
        />
      );
    }

    return (
      <RefereeSelectionPage
        eventCode={hrEventCode}
        events={events}
        isEventsLoading={isEventsLoading}
        onNavigate={onNavigate}
        refereeRole="hr"
      />
    );
  }

  const match = refereeRedScoringMatch ?? refereeBlueScoringMatch;
  if (!match) {
    return null;
  }

  const eventCode = decodePathSegment(match[1]);
  if (eventCode === null) {
    return <RouteErrorPage message="Invalid event code in URL." />;
  }

  const fieldSelection = match[2] ? decodePathSegment(match[2]) : null;

  const role: "red" | "blue" = refereeRedScoringMatch ? "red" : "blue";

  if (fieldSelection) {
    return (
      <MatchSelectionPage
        eventCode={eventCode}
        fieldNumber={fieldSelection}
        onNavigate={onNavigate}
        refereeRole={role}
        token={token}
      />
    );
  }

  return (
    <RefereeSelectionPage
      eventCode={eventCode}
      events={events}
      isEventsLoading={isEventsLoading}
      onNavigate={onNavigate}
      refereeRole={role}
    />
  );
};

interface RenderMatchResultsRoutePageArgs {
  matchAllianceScoresheetMatch: RegExpExecArray | null;
  matchHistoryMatch: RegExpExecArray | null;
  matchResultsMatch: RegExpExecArray | null;
  matchScoresheetMatch: RegExpExecArray | null;
  onNavigate: (path: string) => void;
  token: string | null;
}

const renderMatchResultsRoutePage = ({
  matchResultsMatch,
  matchHistoryMatch,
  matchScoresheetMatch,
  matchAllianceScoresheetMatch,
  onNavigate,
  token,
}: RenderMatchResultsRoutePageArgs) => {
  if (matchResultsMatch) {
    const evCode = decodePathSegment(matchResultsMatch[1]);
    if (evCode === null) {
      return <RouteErrorPage message="Invalid event code" />;
    }
    return (
      <MatchResultsPage
        eventCode={evCode}
        onNavigate={onNavigate}
        token={token}
      />
    );
  }

  if (matchHistoryMatch) {
    const evCode = decodePathSegment(matchHistoryMatch[1]);
    const mName = decodePathSegment(matchHistoryMatch[2]);
    if (evCode === null || mName === null) {
      return <RouteErrorPage message="Invalid URL" />;
    }
    return (
      <MatchHistoryPage
        eventCode={evCode}
        matchName={mName}
        onNavigate={onNavigate}
        token={token}
      />
    );
  }

  if (matchAllianceScoresheetMatch) {
    const evCode = decodePathSegment(matchAllianceScoresheetMatch[1]);
    const mName = decodePathSegment(matchAllianceScoresheetMatch[2]);
    const alliance = matchAllianceScoresheetMatch[3] as "red" | "blue";
    if (evCode === null || mName === null) {
      return <RouteErrorPage message="Invalid URL" />;
    }
    return (
      <MatchScoresheetPage
        allianceFilter={alliance}
        eventCode={evCode}
        matchName={mName}
        onNavigate={onNavigate}
        token={token}
      />
    );
  }

  if (matchScoresheetMatch) {
    const evCode = decodePathSegment(matchScoresheetMatch[1]);
    const mName = decodePathSegment(matchScoresheetMatch[2]);
    if (evCode === null || mName === null) {
      return <RouteErrorPage message="Invalid URL" />;
    }
    return (
      <MatchScoresheetPage
        eventCode={evCode}
        matchName={mName}
        onNavigate={onNavigate}
        token={token}
      />
    );
  }

  return null;
};

export const PageRenderer = ({
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
  const eventControlMatch = EVENT_CONTROL_PATTERN.exec(currentPath);
  const eventReportsMatch = EVENT_REPORTS_PATTERN.exec(currentPath);
  const eventTeamsMatch = EVENT_TEAMS_PATTERN.exec(currentPath);
  const practiceScheduleMatch = PRACTICE_SCHEDULE_PATTERN.exec(currentPath);
  const qualificationScheduleMatch =
    QUALIFICATION_SCHEDULE_PATTERN.exec(currentPath);
  const publicPracticeScheduleMatch =
    PUBLIC_PRACTICE_SCHEDULE_PATTERN.exec(currentPath);
  const publicQualificationScheduleMatch =
    PUBLIC_QUALIFICATION_SCHEDULE_PATTERN.exec(currentPath);
  const publicQualificationRankingsMatch =
    PUBLIC_QUALIFICATION_RANKINGS_PATTERN.exec(currentPath);
  const eventDetailMatch = EVENT_DETAIL_PATTERN.exec(currentPath);
  const defaultAccountsMatch = DEFAULT_ACCOUNTS_PATTERN.exec(currentPath);
  const inspectionTeamsMatch = INSPECTION_TEAMS_PATTERN.exec(currentPath);
  const inspectionNotesMatch = INSPECTION_NOTES_PATTERN.exec(currentPath);
  const inspectionDetailMatch = INSPECTION_DETAIL_PATTERN.exec(currentPath);
  const inspectionEventOverrideMatch =
    INSPECTION_EVENT_OVERRIDE_PATTERN.exec(currentPath);
  const refereeRedScoringMatch = REFEREE_RED_SCORING_PATTERN.exec(currentPath);
  const refereeBlueScoringMatch =
    REFEREE_BLUE_SCORING_PATTERN.exec(currentPath);
  const headRefereeMatch = HEAD_REFEREE_PATTERN.exec(currentPath);
  // More specific match-level routes — must be exec'd before field-level patterns
  const refereeRedScoreEntryMatch =
    REFEREE_RED_SCORE_ENTRY_PATTERN.exec(currentPath);
  const refereeBlueScoreEntryMatch =
    REFEREE_BLUE_SCORE_ENTRY_PATTERN.exec(currentPath);
  const headRefereeMatchEntryMatch =
    HEAD_REFEREE_MATCH_PATTERN.exec(currentPath);

  const hasAdminRoute =
    isCreateEventPage ||
    isCreateAccountPage ||
    isManageUsersPage ||
    Boolean(manageUserDetailMatch) ||
    isManageServerPage ||
    Boolean(editEventMatch) ||
    Boolean(eventDashboardMatch) ||
    Boolean(eventControlMatch) ||
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
        eventControlMatch={eventControlMatch}
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
        onNavigate={onNavigate}
        practiceScheduleMatch={practiceScheduleMatch}
        qualificationScheduleMatch={qualificationScheduleMatch}
        token={token}
        user={user}
      />
    );
  }

  const publicScheduleRoutePage = renderPublicScheduleRoutePage({
    publicPracticeScheduleMatch,
    publicQualificationScheduleMatch,
    token,
  });
  if (publicScheduleRoutePage) {
    return publicScheduleRoutePage;
  }

  const publicQualificationRankingsRoutePage =
    renderPublicQualificationRankingsRoutePage({
      publicQualificationRankingsMatch,
      token,
    });
  if (publicQualificationRankingsRoutePage) {
    return publicQualificationRankingsRoutePage;
  }

  const inspectionRoutePage = renderInspectionRoutePage({
    inspectionDetailMatch,
    inspectionEventOverrideMatch,
    inspectionNotesMatch,
    inspectionTeamsMatch,
    onNavigate,
    token,
  });
  if (inspectionRoutePage) {
    return inspectionRoutePage;
  }

  const refereeRoutePage = renderRefereeRoutePage({
    refereeRedScoringMatch,
    refereeRedScoreEntryMatch,
    refereeBlueScoringMatch,
    refereeBlueScoreEntryMatch,
    headRefereeMatch,
    headRefereeMatchEntryMatch,
    events,
    isEventsLoading,
    onNavigate,
    token,
  });
  if (refereeRoutePage) {
    return refereeRoutePage;
  }

  const matchResultsMatch = MATCH_RESULTS_PATTERN.exec(currentPath);
  const matchHistoryMatch = MATCH_HISTORY_PATTERN.exec(currentPath);
  const matchScoresheetMatch = MATCH_SCORESHEET_PATTERN.exec(currentPath);
  const matchAllianceScoresheetMatch =
    MATCH_ALLIANCE_SCORESHEET_PATTERN.exec(currentPath);

  const matchResultsRoutePage = renderMatchResultsRoutePage({
    matchResultsMatch,
    matchHistoryMatch,
    matchScoresheetMatch,
    matchAllianceScoresheetMatch,
    onNavigate,
    token,
  });
  if (matchResultsRoutePage) {
    return matchResultsRoutePage;
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
