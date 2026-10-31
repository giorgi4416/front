import { isAuthApiError, type AuthError as SupabaseAuthError, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { AppUser, SessionInfo } from '../types';
import { AuthError, type AuthBackend, type ProfileUpdate } from './backend';

const AVATAR_BUCKET = 'avatars';

interface ProfileRow {
  display_name: string | null;
  avatar_url: string | null;
}

/** Turns Supabase's error codes into messages people can act on. */
function friendly(error: SupabaseAuthError | { message: string; code?: string }): AuthError {
  const code = 'code' in error ? error.code : undefined;
  const message = error.message ?? '';
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return new AuthError('Incorrect email or password.');
  }
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
    return new AuthError('Please confirm your email address first — check your inbox for the confirmation link.');
  }
  if (code === 'user_already_exists' || code === 'email_exists' || /already registered/i.test(message)) {
    return new AuthError('An account with this email already exists. Try logging in instead.', 'email');
  }
  if (code === 'weak_password') return new AuthError(message || 'Choose a stronger password.', 'password');
  if (code === 'same_password') return new AuthError('Your new password must be different from the current one.', 'password');
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') {
    return new AuthError('Too many attempts. Please wait a minute and try again.');
  }
  if (/failed to fetch|network/i.test(message)) {
    return new AuthError('Could not reach the server. Check your connection and try again.');
  }
  return new AuthError(message || 'Something went wrong. Please try again.');
}

export class SupabaseAuthBackend implements AuthBackend {
  readonly mode = 'remote' as const;

  constructor(private readonly client: SupabaseClient) {}

  private async toAppUser(user: User): Promise<AppUser> {
    const { data } = await this.client
      .from('profiles')
      .select('display_name,avatar_url')
      .eq('id', user.id)
      .maybeSingle<ProfileRow>();
    return {
      id: user.id,
      email: user.email ?? '',
      displayName: data?.display_name ?? (user.user_metadata?.display_name as string | undefined) ?? '',
      avatarUrl: data?.avatar_url ?? null,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at ?? null,
      pendingEmail: user.new_email ?? null,
    };
  }

  private async currentUser(): Promise<User> {
    const { data, error } = await this.client.auth.getUser();
    if (error || !data.user) throw new AuthError('Your session has expired. Please log in again.');
    return data.user;
  }

  /** Re-checks the password before sensitive changes. */
  private async reauthenticate(email: string, password: string) {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) {
      const err = friendly(error);
      throw err.message === 'Incorrect email or password.'
        ? new AuthError('Your current password is incorrect.', 'currentPassword')
        : err;
    }
  }

  async getUser() {
    const { data: sessionData } = await this.client.auth.getSession();
    if (!sessionData.session) return null;
    // getSession only reads local storage; getUser validates the token with the server.
    const { data, error } = await this.client.auth.getUser();
    if (error) {
      if (isAuthApiError(error)) {
        await this.client.auth.signOut({ scope: 'local' });
        return null;
      }
      // Offline: trust the cached session; API calls are still protected by RLS.
      return this.toAppUser(sessionData.session.user);
    }
    return this.toAppUser(data.user);
  }

  subscribe(listener: (event: 'changed' | 'recovery') => void) {
    const { data } = this.client.auth.onAuthStateChange((event) => {
      // Defer: calling Supabase from inside this callback can deadlock the auth lock.
      setTimeout(() => listener(event === 'PASSWORD_RECOVERY' ? 'recovery' : 'changed'), 0);
    });
    return () => data.subscription.unsubscribe();
  }

  async signIn(email: string, password: string) {
    const { error } = await this.client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw friendly(error);
  }

  async signUp(email: string, password: string, displayName: string) {
    const { data, error } = await this.client.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: displayName.trim() }, emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) throw friendly(error);
    // With email confirmation on, Supabase returns a user with no identities for an existing address.
    if (data.user && data.user.identities?.length === 0) {
      throw new AuthError('An account with this email already exists. Try logging in instead.', 'email');
    }
    return { needsConfirmation: !data.session };
  }

  async signOut() {
    const { error } = await this.client.auth.signOut({ scope: 'local' });
    if (error) throw friendly(error);
  }

  async requestPasswordReset(email: string) {
    const { error } = await this.client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw friendly(error);
    return {};
  }

  async canResetPassword() {
    const { data } = await this.client.auth.getSession();
    return Boolean(data.session);
  }

  async completePasswordReset(newPassword: string) {
    const { error } = await this.client.auth.updateUser({ password: newPassword });
    if (error) throw friendly(error);
  }

  async updateProfile({ displayName, avatar }: ProfileUpdate) {
    const user = await this.currentUser();
    const patch: Partial<ProfileRow> = {};
    if (displayName !== undefined) patch.display_name = displayName.trim();

    if (avatar !== undefined) {
      const { data: existing } = await this.client.storage.from(AVATAR_BUCKET).list(user.id);
      const oldPaths = (existing ?? []).map((file) => `${user.id}/${file.name}`);
      if (avatar) {
        const path = `${user.id}/avatar-${Date.now()}.${avatar.type === 'image/webp' ? 'webp' : 'jpg'}`;
        const { error } = await this.client.storage
          .from(AVATAR_BUCKET)
          .upload(path, avatar, { contentType: avatar.type, upsert: false, cacheControl: '3600' });
        if (error) throw new AuthError(`The avatar could not be uploaded. ${error.message}`);
        patch.avatar_url = this.client.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
      } else {
        patch.avatar_url = null;
      }
      if (oldPaths.length) await this.client.storage.from(AVATAR_BUCKET).remove(oldPaths);
    }

    const { error } = await this.client.from('profiles').upsert({ id: user.id, ...patch });
    if (error) throw new AuthError(`Your profile could not be saved. ${error.message}`);
  }

  async updateEmail(newEmail: string, currentPassword: string) {
    const user = await this.currentUser();
    if (newEmail.trim().toLowerCase() === user.email?.toLowerCase()) {
      throw new AuthError('That is already your email address.', 'email');
    }
    await this.reauthenticate(user.email ?? '', currentPassword);
    const { data, error } = await this.client.auth.updateUser(
      { email: newEmail.trim() },
      { emailRedirectTo: `${window.location.origin}/` },
    );
    if (error) throw friendly(error);
    return { needsConfirmation: data.user?.email?.toLowerCase() !== newEmail.trim().toLowerCase() };
  }

  async updatePassword(currentPassword: string, newPassword: string) {
    const user = await this.currentUser();
    await this.reauthenticate(user.email ?? '', currentPassword);
    const { error } = await this.client.auth.updateUser({ password: newPassword });
    if (error) throw friendly(error);
  }

  async listSessions(): Promise<SessionInfo[]> {
    // Supabase doesn't expose other devices' sessions to the client; show the current one.
    const user = await this.currentUser();
    return [
      { id: 'current', current: true, createdAt: user.last_sign_in_at ?? user.created_at, userAgent: navigator.userAgent },
    ];
  }

  async revokeSession() {
    await this.signOutOtherSessions();
  }

  async signOutOtherSessions() {
    const { error } = await this.client.auth.signOut({ scope: 'others' });
    if (error) throw friendly(error);
  }

  async deleteAccount(password: string) {
    const user = await this.currentUser();
    await this.reauthenticate(user.email ?? '', password);
    const { data: files } = await this.client.storage.from(AVATAR_BUCKET).list(user.id);
    if (files?.length) await this.client.storage.from(AVATAR_BUCKET).remove(files.map((f) => `${user.id}/${f.name}`));
    const { error } = await this.client.rpc('delete_own_account');
    if (error) throw new AuthError(`Your account could not be deleted. ${error.message}`);
    await this.client.auth.signOut({ scope: 'local' });
  }
}
