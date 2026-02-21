import { useEffect, useState } from "react";
import { TOKEN_STORAGE_KEY } from "../../../shared/constants/storage";
import type {
  AuthRoutePath,
  AuthUser,
  LoginCredentials,
} from "../../../shared/types/auth";
import {
  fetchCurrentUser,
  loginUser,
  logoutUser,
} from "../services/auth-service";

interface UseAuthResult {
  clearError: () => void;
  errorMessage: string | null;
  isAuthLoading: boolean;
  isLoginSubmitting: boolean;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => Promise<void>;
  navigateToHome: () => void;
  navigateToLogin: () => void;
  token: string | null;
  user: AuthUser | null;
}

const readStoredToken = (): string | null =>
  localStorage.getItem(TOKEN_STORAGE_KEY);

const navigateToRoute = (path: AuthRoutePath): void => {
  if (typeof window === "undefined") {
    return;
  }

  if (window.location.pathname === path) {
    return;
  }

  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

export const useAuth = (): UseAuthResult => {
  const [token, setToken] = useState<string | null>(readStoredToken);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isLoginSubmitting, setIsLoginSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const updateUserState = (nextUser: AuthUser | null): void => {
      if (isCancelled) {
        return;
      }
      setUser(nextUser);
    };

    const updateErrorState = (nextError: string | null): void => {
      if (isCancelled) {
        return;
      }
      setErrorMessage(nextError);
    };

    const updateAuthLoading = (value: boolean): void => {
      if (isCancelled) {
        return;
      }
      setIsAuthLoading(value);
    };

    if (!token) {
      updateUserState(null);
      updateAuthLoading(false);

      return () => {
        isCancelled = true;
      };
    }

    updateAuthLoading(true);

    fetchCurrentUser(token)
      .then((currentUser) => {
        updateUserState(currentUser);
        updateErrorState(null);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        if (isCancelled) {
          return;
        }
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        updateAuthLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [token]);

  const clearError = (): void => {
    setErrorMessage(null);
  };

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    setIsLoginSubmitting(true);
    setErrorMessage(null);

    try {
      const { token: nextToken, user: nextUser } = await loginUser(credentials);
      localStorage.setItem(TOKEN_STORAGE_KEY, nextToken);
      setToken(nextToken);
      setUser(nextUser);
      return true;
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to log in."
      );
      return false;
    } finally {
      setIsLoginSubmitting(false);
    }
  };

  const logout = async (): Promise<void> => {
    if (token) {
      try {
        await logoutUser(token);
      } catch {
        // Ignore logout errors to avoid trapping the user in an invalid session.
      }
    }

    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setErrorMessage(null);
    setIsAuthLoading(false);
  };

  const navigateToHome = (): void => {
    navigateToRoute("/");
  };

  const navigateToLogin = (): void => {
    navigateToRoute("/login");
  };

  return {
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
  };
};
