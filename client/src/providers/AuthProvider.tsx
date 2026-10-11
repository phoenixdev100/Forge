import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, api, hasSessionHint, onAuthFailure } from '@/lib/api';
import { qk, queryClient } from '@/lib/queryClient';
import type { User } from '@/lib/types';
import type { Unit } from '@/lib/units';

type AuthState = {
  user: User | null;
  /** `true` only until the initial session check resolves. */
  isLoading: boolean;
  isAuthenticated: boolean;
  /** The user's display unit, with a safe default before the user loads. */
  unit: Unit;
  login: (email: string, password: string) => Promise<User>;
  register: (input: { name: string; email: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

type MeResponse = { user: User };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSession = useCallback(async () => {
    // No session marker -> anonymous. Skip the probe entirely rather than
    // paying for two expected 401s on every anonymous page load.
    if (!hasSessionHint()) {
      setUserState(null);
      setIsLoading(false);
      return;
    }
    try {
      const { user: me } = await api.get<MeResponse>('/auth/me');
      setUserState(me);
    } catch (err) {
      // A 401 here just means "not signed in" - not an error worth surfacing.
      if (!(err instanceof ApiError) || !err.isAuthError) {
        console.error('Failed to restore session', err);
      }
      setUserState(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  // When a refresh attempt fails for good, drop local state so the router can
  // bounce the user to the login screen instead of rendering broken pages.
  useEffect(() => {
    const off = onAuthFailure(() => {
      setUserState(null);
      queryClient.clear();
    });
    return () => {
      off();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user: me } = await api.post<MeResponse>('/auth/login', { email, password });
    setUserState(me);
    queryClient.clear();
    return me;
  }, []);

  const register = useCallback(async (input: { name: string; email: string; password: string }) => {
    const { user: me } = await api.post<MeResponse>('/auth/register', {
      ...input,
      // Captured so "today" is correct for a user who travels or lives in UTC+13.
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    setUserState(me);
    queryClient.clear();
    return me;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUserState(null);
      queryClient.clear();
      // The service worker keeps last-loaded data for offline use; drop it so
      // the next person on this device never sees this account's data offline.
      if ('caches' in window) {
        void caches.keys().then((keys) =>
          Promise.all(keys.filter((k) => k.startsWith('forge-data-')).map((k) => caches.delete(k))),
        );
      }
    }
  }, []);

  const setUser = useCallback((next: User) => {
    setUserState(next);
    queryClient.setQueryData(qk.me, { user: next });
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      unit: user?.unit ?? 'KG',
      login,
      register,
      logout,
      setUser,
      refresh: loadSession,
    }),
    [user, isLoading, login, register, logout, setUser, loadSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/** Narrowed accessor for screens that are always behind a guard. */
export function useCurrentUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('useCurrentUser used outside an authenticated route');
  return user;
}

export function useUnit(): Unit {
  return useAuth().unit;
}
