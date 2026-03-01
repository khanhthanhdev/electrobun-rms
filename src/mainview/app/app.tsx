import { Suspense, useEffect, useRef, useState } from "react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useEvents } from "@/features/events/hooks/use-events";
import type { LoginCredentials } from "@/shared/types/auth";
import { AppHeader } from "@/widgets/app-header/app-header";
import {
  hasAdminGlobalRole,
  PageLoadingFallback,
  PageRenderer,
} from "./page-renderer";
import { readCurrentPath } from "./route-matcher";

const App = (): JSX.Element => {
  const [currentPath, setCurrentPath] = useState(readCurrentPath);
  const previousPathRef = useRef(currentPath);
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
        <PageRenderer
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
