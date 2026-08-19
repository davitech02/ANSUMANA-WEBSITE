import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Proponent, User, UserRole } from '../types';
import { authApi } from './api';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setSessionExpiredHandler,
  setTokens,
} from './api/client';
import type { ApiError } from './api/client';

interface AuthResult {
  success: boolean;
  error?: string;
  role?: UserRole;
}

interface AuthContextType {
  user: User | null;
  proponent: Proponent | null;
  role: UserRole;
  isAuthenticated: boolean;
  /** True while an existing session is being restored on mount. */
  isRestoring: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (
    fullName: string,
    email: string,
    password: string,
    companyName?: string,
  ) => Promise<AuthResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function toErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as ApiError).message);
  }
  return 'Something went wrong. Please try again.';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [proponent, setProponent] = useState<Proponent | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  const clearSession = useCallback(() => {
    clearTokens();
    setUser(null);
    setProponent(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSessionExpiredHandler(() => clearSession());

    async function restoreSession() {
      if (!getAccessToken()) {
        if (!cancelled) setIsRestoring(false);
        return;
      }
      try {
        const me = await authApi.fetchMe();
        if (!cancelled) {
          setUser(me.user);
          setProponent(me.proponent);
        }
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setIsRestoring(false);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
      setSessionExpiredHandler(null);
    };
  }, [clearSession]);

  const login = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      try {
        const session = await authApi.login({ email, password });
        setTokens(session.access_token, session.refresh_token);
        setUser(session.user);
        setProponent(session.proponent);
        return { success: true, role: session.user.role };
      } catch (error) {
        return { success: false, error: toErrorMessage(error) };
      }
    },
    [],
  );

  const register = useCallback(
    async (
      fullName: string,
      email: string,
      password: string,
      companyName?: string,
    ): Promise<AuthResult> => {
      try {
        const session = await authApi.register({
          full_name: fullName,
          email,
          password,
          company_name: companyName || undefined,
        });
        setTokens(session.access_token, session.refresh_token);
        setUser(session.user);
        setProponent(session.proponent);
        return { success: true, role: session.user.role };
      } catch (error) {
        return { success: false, error: toErrorMessage(error) };
      }
    },
    [],
  );

  const logout = useCallback(async (): Promise<void> => {
    const refreshToken = getRefreshToken();
    try {
      await authApi.logout(refreshToken);
    } catch {
      /* best-effort server revocation */
    }
    clearSession();
  }, [clearSession]);

  const role: UserRole = user?.role || 'client';
  const isAuthenticated = !!user;

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      proponent,
      role,
      isAuthenticated,
      isRestoring,
      login,
      register,
      logout,
    }),
    [user, proponent, role, isAuthenticated, isRestoring, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};