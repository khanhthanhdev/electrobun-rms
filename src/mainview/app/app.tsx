import { useEffect, useState } from "react";
import { LoginForm } from "../features/auth/components/login-dialog";
import { useAuth } from "../features/auth/hooks/use-auth";
import { useEvents } from "../features/events/hooks/use-events";
import { HomePage } from "../pages/home-page";
import type { LoginCredentials } from "../shared/types/auth";
import { AppHeader } from "../widgets/app-header/app-header";

const readCurrentPath = (): string => {
  if (typeof window === "undefined") {
    return "/";
  }

  return window.location.pathname;
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
    user,
  } = useAuth();
  const { events, isEventsLoading } = useEvents();

  useEffect(() => {
    const handlePopState = (): void => {
      setCurrentPath(readCurrentPath());
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

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

  return (
    <>
      <AppHeader
        isAuthLoading={isAuthLoading}
        onLoginClick={openLoginDialog}
        onLogoutClick={logout}
        user={user}
      />

      {isLoginPage ? (
        <LoginForm
          errorMessage={errorMessage}
          isSubmitting={isLoginSubmitting}
          onSubmit={handleLoginSubmit}
        />
      ) : (
        <HomePage events={events} isEventsLoading={isEventsLoading} />
      )}
    </>
  );
};

export default App;
