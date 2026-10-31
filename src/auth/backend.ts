import type { AppUser, SessionInfo } from '../types';

export interface ProfileUpdate {
  displayName?: string;
  /** A new (already resized) avatar image, or null to remove the current one. */
  avatar?: Blob | null;
}

/**
 * Authentication provider. `SupabaseAuthBackend` is the production implementation;
 * `LocalAuthBackend` is a browser-only demo used when Supabase isn't configured.
 */
export interface AuthBackend {
  readonly mode: 'remote' | 'local';
  /** Returns the signed-in user after validating the stored session, or null. */
  getUser(): Promise<AppUser | null>;
  /** Fires when the session or user changes (sign in/out, other tabs, token refresh, recovery links). */
  subscribe(listener: (event: 'changed' | 'recovery') => void): () => void;

  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, displayName: string): Promise<{ needsConfirmation: boolean }>;
  signOut(): Promise<void>;

  /** In demo mode, returns the reset link that a real deployment would email. */
  requestPasswordReset(email: string): Promise<{ demoResetUrl?: string }>;
  /** Whether a reset link can be used (local token check, or an active recovery session). */
  canResetPassword(token: string | null): Promise<boolean>;
  completePasswordReset(newPassword: string, token: string | null): Promise<void>;

  updateProfile(update: ProfileUpdate): Promise<void>;
  updateEmail(newEmail: string, currentPassword: string): Promise<{ needsConfirmation: boolean }>;
  updatePassword(currentPassword: string, newPassword: string): Promise<void>;

  listSessions(): Promise<SessionInfo[]>;
  revokeSession(id: string): Promise<void>;
  signOutOtherSessions(): Promise<void>;
  deleteAccount(password: string): Promise<void>;
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly field?: 'email' | 'password' | 'currentPassword' | 'displayName',
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Email address is required.';
  if (!EMAIL_PATTERN.test(email.trim())) return 'Enter a valid email address, like name@example.com.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Use at least one letter and one number.';
  return null;
}

/** 0–4 score for the strength meter. */
export function passwordStrength(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  return Math.max(1, score);
}
