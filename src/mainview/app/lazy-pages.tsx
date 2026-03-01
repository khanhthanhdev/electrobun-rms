import { lazy } from "react";

export const LoginForm = lazy(() =>
  import("@/features/auth/components/login-dialog").then((module) => ({
    default: module.LoginForm,
  }))
);
export const AdminPlaceholderPage = lazy(() =>
  import("@/pages/admin/admin-placeholder-page").then((module) => ({
    default: module.AdminPlaceholderPage,
  }))
);
export const CreateEventPage = lazy(() =>
  import("@/pages/events/create-event-page").then((module) => ({
    default: module.CreateEventPage,
  }))
);
export const DefaultAccountsPage = lazy(() =>
  import("@/pages/events/default-accounts-page").then((module) => ({
    default: module.DefaultAccountsPage,
  }))
);
export const EditEventPage = lazy(() =>
  import("@/pages/events/edit-event-page").then((module) => ({
    default: module.EditEventPage,
  }))
);
export const EventDashboardPage = lazy(() =>
  import("@/pages/events/event-dashboard-page").then((module) => ({
    default: module.EventDashboardPage,
  }))
);
export const EventControlPage = lazy(() =>
  import("@/pages/events/control/event-control-page").then((module) => ({
    default: module.EventControlPage,
  }))
);
export const EventPage = lazy(() =>
  import("@/pages/events/event-page").then((module) => ({
    default: module.EventPage,
  }))
);
export const EventReportsPage = lazy(() =>
  import("@/pages/events/event-reports-page").then((module) => ({
    default: module.EventReportsPage,
  }))
);
export const TeamsPage = lazy(() =>
  import("@/pages/events/teams-page").then((module) => ({
    default: module.TeamsPage,
  }))
);
export const PracticeSchedulePage = lazy(() =>
  import("@/pages/events/schedule/practice-schedule-page").then((module) => ({
    default: module.PracticeSchedulePage,
  }))
);
export const QualificationSchedulePage = lazy(() =>
  import("@/pages/events/schedule/qualification-schedule-page").then(
    (module) => ({
      default: module.QualificationSchedulePage,
    })
  )
);
export const PracticeScheduleViewPage = lazy(() =>
  import("@/pages/events/schedule/practice-schedule-view-page").then(
    (module) => ({
      default: module.PracticeScheduleViewPage,
    })
  )
);
export const QualificationScheduleViewPage = lazy(() =>
  import("@/pages/events/schedule/qualification-schedule-view-page").then(
    (module) => ({
      default: module.QualificationScheduleViewPage,
    })
  )
);
export const QualificationRankingsViewPage = lazy(() =>
  import("@/pages/events/ranking/qualification-rankings-view-page").then(
    (module) => ({
      default: module.QualificationRankingsViewPage,
    })
  )
);
export const HomePage = lazy(() =>
  import("@/pages/home/home-page").then((module) => ({
    default: module.HomePage,
  }))
);
export const CreateAccountPage = lazy(() =>
  import("@/pages/users/create-account-page").then((module) => ({
    default: module.CreateAccountPage,
  }))
);
export const ManageUserPage = lazy(() =>
  import("@/pages/users/manage-user-page").then((module) => ({
    default: module.ManageUserPage,
  }))
);
export const InspectionDetailPage = lazy(() =>
  import("@/pages/events/inspection/inspection-detail-page").then((module) => ({
    default: module.InspectionDetailPage,
  }))
);
export const InspectionEventOverridePage = lazy(() =>
  import("@/pages/events/inspection/inspection-event-override-page").then(
    (module) => ({
      default: module.InspectionEventOverridePage,
    })
  )
);
export const InspectionNotesPage = lazy(() =>
  import("@/pages/events/inspection/inspection-notes-page").then((module) => ({
    default: module.InspectionNotesPage,
  }))
);
export const InspectionTeamsPage = lazy(() =>
  import("@/pages/events/inspection/inspection-teams-page").then((module) => ({
    default: module.InspectionTeamsPage,
  }))
);
export const ManageUsersPage = lazy(() =>
  import("@/pages/users/manage-users-page").then((module) => ({
    default: module.ManageUsersPage,
  }))
);
export const RefereeSelectionPage = lazy(() =>
  import("@/pages/events/referee/referee-selection-page").then((module) => ({
    default: module.RefereeSelectionPage,
  }))
);
export const MatchSelectionPage = lazy(() =>
  import("@/pages/events/referee/match-selection-page").then((module) => ({
    default: module.MatchSelectionPage,
  }))
);
export const ScoringEntryPage = lazy(() =>
  import("@/pages/events/referee/scoring-entry-page").then((module) => ({
    default: module.ScoringEntryPage,
  }))
);
export const HrMatchPage = lazy(() =>
  import("@/pages/events/referee/hr-match-page").then((module) => ({
    default: module.HrMatchPage,
  }))
);
export const HeadRefereePage = lazy(() =>
  import("@/pages/events/referee/head-referee-page").then((module) => ({
    default: module.HeadRefereePage,
  }))
);
export const MatchResultsPage = lazy(() =>
  import("@/pages/events/results/match-results-page").then((module) => ({
    default: module.MatchResultsPage,
  }))
);
export const MatchHistoryPage = lazy(() =>
  import("@/pages/events/results/match-history-page").then((module) => ({
    default: module.MatchHistoryPage,
  }))
);
export const MatchScoresheetPage = lazy(() =>
  import("@/pages/events/results/match-scoresheet-page").then((module) => ({
    default: module.MatchScoresheetPage,
  }))
);
