import { LEGACY_WORKSPACE_KEY, workspaceStorageKey } from '../data/localRepository';
import { newId, nowIso } from '../lib/utils';
import type { AppUser, SessionInfo } from '../types';
import { AuthError, type AuthBackend, type ProfileUpdate } from './backend';

/*
 * DEMO-ONLY authentication. Everything lives in this browser's localStorage, so anyone
 * with access to the device can read or alter it. Passwords are salted and hashed
 * (PBKDF2-SHA-256) so they are never stored in plaintext, but this is NOT a security
 * boundary — use Supabase Auth for real deployments.
 */

const USERS_KEY = 'notes-app:demo-auth:users:v1';
const SESSIONS_KEY = 'notes-app:demo-auth:sessions:v1';
const CURRENT_KEY = 'notes-app:demo-auth:current-session';
const RESETS_KEY = 'notes-app:demo-auth:resets:v1';
const WATCHED_KEYS = new Set([USERS_KEY, SESSIONS_KEY, CURRENT_KEY]);

const PBKDF2_ITERATIONS = 210_000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 30 * 60 * 1000;

interface StoredUser {
  id: string;
  email: string;
  displayName: string;
  avatarDataUrl: string | null;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  lastSignInAt: string | null;
}

interface StoredSession {
  id: string;
  userId: string;
  createdAt: string;
  userAgent: string;
}

interface StoredReset {
  tokenHash: string;
  userId: string;
  expiresAt: number;
}

const encoder = new TextEncoder();
const toBase64 = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));

async function hashPassword(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return toBase64(bits);
}

async function sha256(value: string): Promise<string> {
  return toBase64(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

/** Comparison that doesn't short-circuit on the first differing character. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new AuthError('Browser storage is full or blocked, so the account could not be saved.');
  }
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const toAppUser = (user: StoredUser): AppUser => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  avatarUrl: user.avatarDataUrl,
  createdAt: user.createdAt,
  lastSignInAt: user.lastSignInAt,
  pendingEmail: null,
});

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new AuthError('The image could not be read.'));
    reader.readAsDataURL(blob);
  });
}

export class LocalAuthBackend implements AuthBackend {
  readonly mode = 'local' as const;
  private listeners = new Set<(event: 'changed' | 'recovery') => void>();

  constructor() {
    // Keep tabs in sync: signing out in one tab signs out the others.
    window.addEventListener('storage', (event) => {
      if (event.key && WATCHED_KEYS.has(event.key)) this.emit();
    });
  }

  private users = () => read<StoredUser[]>(USERS_KEY, []);
  private sessions = () => read<StoredSession[]>(SESSIONS_KEY, []);
  private currentSessionId = () => read<string | null>(CURRENT_KEY, null);

  private emit() {
    for (const listener of this.listeners) listener('changed');
  }

  private currentSession(): StoredSession | null {
    const id = this.currentSessionId();
    const session = id ? this.sessions().find((s) => s.id === id) : undefined;
    if (!session) return null;
    if (Date.now() - Date.parse(session.createdAt) > SESSION_TTL_MS) return null;
    return session;
  }

  private requireUser(): StoredUser {
    const session = this.currentSession();
    const user = session && this.users().find((u) => u.id === session.userId);
    if (!user) throw new AuthError('Your session has expired. Please log in again.');
    return user;
  }

  private saveUser(user: StoredUser) {
    write(
      USERS_KEY,
      this.users().map((u) => (u.id === user.id ? user : u)),
    );
  }

  private async verifyPassword(user: StoredUser, password: string): Promise<boolean> {
    return safeEqual(await hashPassword(password, fromBase64(user.passwordSalt)), user.passwordHash);
  }

  private async setPassword(user: StoredUser, password: string) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    user.passwordSalt = toBase64(salt);
    user.passwordHash = await hashPassword(password, salt);
  }

  private startSession(user: StoredUser) {
    const session: StoredSession = { id: newId(), userId: user.id, createdAt: nowIso(), userAgent: navigator.userAgent };
    write(SESSIONS_KEY, [...this.sessions(), session]);
    write(CURRENT_KEY, session.id);
    user.lastSignInAt = session.createdAt;
    this.saveUser(user);
    this.emit();
  }

  async getUser() {
    const session = this.currentSession();
    if (!session) {
      if (this.currentSessionId()) localStorage.removeItem(CURRENT_KEY);
      return null;
    }
    const user = this.users().find((u) => u.id === session.userId);
    return user ? toAppUser(user) : null;
  }

  subscribe(listener: (event: 'changed' | 'recovery') => void) {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  async signIn(email: string, password: string) {
    const user = this.users().find((u) => u.email === normalizeEmail(email));
    // Hash even when the user doesn't exist so timing doesn't reveal which emails are registered.
    const ok = user ? await this.verifyPassword(user, password) : (await hashPassword(password, new Uint8Array(16)), false);
    if (!user || !ok) throw new AuthError('Incorrect email or password.');
    this.startSession(user);
  }

  async signUp(email: string, password: string, displayName: string) {
    const users = this.users();
    const normalized = normalizeEmail(email);
    if (users.some((u) => u.email === normalized)) {
      throw new AuthError('An account with this email already exists. Try logging in instead.', 'email');
    }
    const user: StoredUser = {
      id: newId(),
      email: normalized,
      displayName: displayName.trim(),
      avatarDataUrl: null,
      passwordHash: '',
      passwordSalt: '',
      createdAt: nowIso(),
      lastSignInAt: null,
    };
    await this.setPassword(user, password);
    write(USERS_KEY, [...users, user]);

    // Notes created before accounts existed belong to the first account on this browser.
    const legacy = localStorage.getItem(LEGACY_WORKSPACE_KEY);
    if (users.length === 0 && legacy) {
      localStorage.setItem(workspaceStorageKey(user.id), legacy);
      localStorage.removeItem(LEGACY_WORKSPACE_KEY);
    }

    this.startSession(user);
    return { needsConfirmation: false };
  }

  async signOut() {
    const id = this.currentSessionId();
    write(SESSIONS_KEY, this.sessions().filter((s) => s.id !== id));
    localStorage.removeItem(CURRENT_KEY);
    this.emit();
  }

  async requestPasswordReset(email: string) {
    const user = this.users().find((u) => u.email === normalizeEmail(email));
    if (!user) return {};
    const token = toBase64(crypto.getRandomValues(new Uint8Array(24))).replace(/[+/=]/g, '');
    const resets = read<StoredReset[]>(RESETS_KEY, []).filter((r) => r.expiresAt > Date.now() && r.userId !== user.id);
    write(RESETS_KEY, [...resets, { tokenHash: await sha256(token), userId: user.id, expiresAt: Date.now() + RESET_TTL_MS }]);
    return { demoResetUrl: `${window.location.origin}/reset-password?token=${token}` };
  }

  private async findReset(token: string | null): Promise<StoredReset | null> {
    if (!token) return null;
    const hash = await sha256(token);
    return read<StoredReset[]>(RESETS_KEY, []).find((r) => r.tokenHash === hash && r.expiresAt > Date.now()) ?? null;
  }

  async canResetPassword(token: string | null) {
    return (await this.findReset(token)) !== null;
  }

  async completePasswordReset(newPassword: string, token: string | null) {
    const reset = await this.findReset(token);
    const user = reset && this.users().find((u) => u.id === reset.userId);
    if (!reset || !user) throw new AuthError('This reset link is invalid or has expired. Request a new one.');
    await this.setPassword(user, newPassword);
    this.saveUser(user);
    write(RESETS_KEY, read<StoredReset[]>(RESETS_KEY, []).filter((r) => r.userId !== user.id));
    // A password reset ends every existing session for that account.
    write(SESSIONS_KEY, this.sessions().filter((s) => s.userId !== user.id));
    if (this.currentSession() === null) localStorage.removeItem(CURRENT_KEY);
    this.emit();
  }

  async updateProfile({ displayName, avatar }: ProfileUpdate) {
    const user = this.requireUser();
    if (displayName !== undefined) user.displayName = displayName.trim();
    if (avatar !== undefined) user.avatarDataUrl = avatar ? await blobToDataUrl(avatar) : null;
    this.saveUser(user);
    this.emit();
  }

  async updateEmail(newEmail: string, currentPassword: string) {
    const user = this.requireUser();
    if (!(await this.verifyPassword(user, currentPassword))) {
      throw new AuthError('Your current password is incorrect.', 'currentPassword');
    }
    const normalized = normalizeEmail(newEmail);
    if (normalized === user.email) throw new AuthError('That is already your email address.', 'email');
    if (this.users().some((u) => u.email === normalized)) {
      throw new AuthError('Another account already uses this email.', 'email');
    }
    user.email = normalized;
    this.saveUser(user);
    this.emit();
    return { needsConfirmation: false };
  }

  async updatePassword(currentPassword: string, newPassword: string) {
    const user = this.requireUser();
    if (!(await this.verifyPassword(user, currentPassword))) {
      throw new AuthError('Your current password is incorrect.', 'currentPassword');
    }
    await this.setPassword(user, newPassword);
    this.saveUser(user);
  }

  async listSessions(): Promise<SessionInfo[]> {
    const user = this.requireUser();
    const current = this.currentSessionId();
    return this.sessions()
      .filter((s) => s.userId === user.id && Date.now() - Date.parse(s.createdAt) <= SESSION_TTL_MS)
      .map((s) => ({ id: s.id, current: s.id === current, createdAt: s.createdAt, userAgent: s.userAgent }))
      .sort((a, b) => Number(b.current) - Number(a.current) || b.createdAt.localeCompare(a.createdAt));
  }

  async revokeSession(id: string) {
    const user = this.requireUser();
    write(SESSIONS_KEY, this.sessions().filter((s) => !(s.id === id && s.userId === user.id)));
    this.emit();
  }

  async signOutOtherSessions() {
    const user = this.requireUser();
    const current = this.currentSessionId();
    write(SESSIONS_KEY, this.sessions().filter((s) => s.userId !== user.id || s.id === current));
    this.emit();
  }

  async deleteAccount(password: string) {
    const user = this.requireUser();
    if (!(await this.verifyPassword(user, password))) {
      throw new AuthError('Your password is incorrect.', 'currentPassword');
    }
    write(USERS_KEY, this.users().filter((u) => u.id !== user.id));
    write(SESSIONS_KEY, this.sessions().filter((s) => s.userId !== user.id));
    write(RESETS_KEY, read<StoredReset[]>(RESETS_KEY, []).filter((r) => r.userId !== user.id));
    localStorage.removeItem(workspaceStorageKey(user.id));
    localStorage.removeItem(CURRENT_KEY);
    this.emit();
  }
}
