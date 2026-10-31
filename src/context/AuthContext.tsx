import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthBackend } from '../auth/backend';
import { LocalAuthBackend } from '../auth/localAuthBackend';
import { SupabaseAuthBackend } from '../auth/supabaseAuthBackend';
import { supabase } from '../lib/supabase';
import type { AppUser } from '../types';

type AuthStatus = 'loading' | 'signed-out' | 'signed-in';

type BackendActions = Pick<
  AuthBackend,
  | 'signIn'
  | 'signUp'
  | 'requestPasswordReset'
  | 'canResetPassword'
  | 'completePasswordReset'
  | 'updateProfile'
  | 'updateEmail'
  | 'updatePassword'
  | 'listSessions'
  | 'revokeSession'
  | 'signOutOtherSessions'
  | 'deleteAccount'
  | 'signOut'
>;

interface AuthApi extends BackendActions {
  status: AuthStatus;
  user: AppUser | null;
  /** 'local' = browser-only demo accounts (Supabase not configured). */
  mode: AuthBackend['mode'];
  /** True after arriving from a Supabase password-recovery email link. */
  recovery: boolean;
  clearRecovery: () => void;
  refresh: () => Promise<void>;
}

const backend: AuthBackend = supabase ? new SupabaseAuthBackend(supabase) : new LocalAuthBackend();

const AuthContext = createContext<AuthApi | null>(null);

/** Same user data → same object, so the workspace isn't reloaded on token refreshes. */
const sameUser = (a: AppUser | null, b: AppUser | null) => JSON.stringify(a) === JSON.stringify(b);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AppUser | null>(null);
  const [recovery, setRecovery] = useState(false);

  const refresh = useCallback(async () => {
    let next: AppUser | null = null;
    try {
      next = await backend.getUser();
    } catch {
      next = null;
    }
    setUser((prev) => (sameUser(prev, next) ? prev : next));
    setStatus(next ? 'signed-in' : 'signed-out');
  }, []);

  useEffect(() => {
    void refresh();
    return backend.subscribe((event) => {
      if (event === 'recovery') setRecovery(true);
      void refresh();
    });
  }, [refresh]);

  const api = useMemo<AuthApi>(() => {
    // Mutations refresh the user afterwards so profile changes show up immediately.
    const withRefresh =
      <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
      async (...args: A) => {
        const result = await fn(...args);
        await refresh();
        return result;
      };
    return {
      status,
      user,
      mode: backend.mode,
      recovery,
      clearRecovery: () => setRecovery(false),
      refresh,
      signIn: withRefresh(backend.signIn.bind(backend)),
      signUp: withRefresh(backend.signUp.bind(backend)),
      signOut: withRefresh(backend.signOut.bind(backend)),
      requestPasswordReset: backend.requestPasswordReset.bind(backend),
      canResetPassword: backend.canResetPassword.bind(backend),
      completePasswordReset: withRefresh(backend.completePasswordReset.bind(backend)),
      updateProfile: withRefresh(backend.updateProfile.bind(backend)),
      updateEmail: withRefresh(backend.updateEmail.bind(backend)),
      updatePassword: backend.updatePassword.bind(backend),
      listSessions: backend.listSessions.bind(backend),
      revokeSession: backend.revokeSession.bind(backend),
      signOutOtherSessions: backend.signOutOtherSessions.bind(backend),
      deleteAccount: withRefresh(backend.deleteAccount.bind(backend)),
    };
  }, [status, user, recovery, refresh]);

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
