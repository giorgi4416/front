import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { LogOut, Monitor, Smartphone, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSignOut } from '../../hooks/useSignOut';
import { navigate } from '../../lib/router';
import { errorMessage, formatDateTime } from '../../lib/utils';
import type { SessionInfo } from '../../types';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Dialog } from '../ui/Dialog';
import { PasswordField, TextField } from '../ui/FormField';
import { Spinner } from '../ui/Spinner';

function describeDevice(userAgent: string): { label: string; mobile: boolean } {
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'Browser';
  const os = /Windows/.test(userAgent)
    ? 'Windows'
    : /Android/.test(userAgent)
      ? 'Android'
      : /iPhone|iPad/.test(userAgent)
        ? 'iOS'
        : /Mac OS X/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : 'Unknown OS';
  return { label: `${browser} on ${os}`, mobile: /Mobi|Android|iPhone/.test(userAgent) };
}

function DeleteAccountDialog({ open, onClose, onDeleted }: { open: boolean; onClose: () => void; onDeleted: () => void }) {
  const { deleteAccount, mode } = useAuth();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword('');
      setPhrase('');
      setError(null);
    }
  }, [open]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(password);
      onDeleted();
      navigate('/signup', { replace: true });
      toast.success('Your account and all of its notes were deleted.');
    } catch (err) {
      setError(errorMessage(err, 'Your account could not be deleted.'));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Delete account"
      icon={<Trash2 size={20} />}
      description={
        <>
          This permanently deletes your account and every note, folder and tag in it
          {mode === 'local' ? ' from this browser' : ''}. This cannot be undone.
        </>
      }
    >
      <form className="form-stack" onSubmit={submit} noValidate>
        <PasswordField
          label="Your password"
          autoComplete="current-password"
          value={password}
          error={error}
          onChange={(e) => setPassword(e.target.value)}
        />
        <TextField
          label="Type DELETE to confirm"
          autoComplete="off"
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
        />
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-danger" disabled={busy || phrase !== 'DELETE' || !password}>
            {busy && <Spinner size={14} />} Delete my account
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function SecuritySection({ onAccountDeleted }: { onAccountDeleted: () => void }) {
  const { mode, listSessions, revokeSession, signOutOtherSessions } = useAuth();
  const toast = useToast();
  const signOut = useSignOut();
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setSessions(await listSessions());
      setLoadError(null);
    } catch (error) {
      setLoadError(errorMessage(error, 'Sessions could not be loaded.'));
    }
  }, [listSessions]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (key: string, action: () => Promise<void>, success: string) => {
    setBusy(key);
    try {
      await action();
      toast.success(success);
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const others = sessions?.filter((s) => !s.current).length ?? 0;

  return (
    <div className="account-sections">
      <section className="account-card">
        <h3 className="account-card-title">Active sessions</h3>
        <p className="account-card-hint">
          {mode === 'local'
            ? 'Demo sessions stored in this browser (each login creates one).'
            : 'Supabase doesn’t list other devices to the browser, but you can sign them all out.'}
        </p>
        {loadError && <p className="form-error">{loadError}</p>}
        {!sessions && !loadError && <Spinner size={18} label="Loading sessions" />}
        {sessions && (
          <ul className="session-list">
            {sessions.map((session) => {
              const device = describeDevice(session.userAgent);
              return (
                <li key={session.id} className="session-item">
                  <span className="session-icon">{device.mobile ? <Smartphone size={18} /> : <Monitor size={18} />}</span>
                  <span className="session-text">
                    <strong>
                      {device.label}
                      {session.current && <span className="badge-current">This device</span>}
                    </strong>
                    <span>Signed in {formatDateTime(session.createdAt)}</span>
                  </span>
                  {!session.current && mode === 'local' && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busy !== null}
                      onClick={() => run(session.id, () => revokeSession(session.id), 'Session signed out.')}
                    >
                      {busy === session.id && <Spinner size={12} />} Sign out
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy !== null || (mode === 'local' && others === 0)}
            onClick={() => run('others', signOutOtherSessions, 'Signed out of all other sessions.')}
          >
            {busy === 'others' && <Spinner size={14} />} Sign out all other sessions
          </button>
          <button type="button" className="btn btn-outline" disabled={signOut.busy} onClick={() => void signOut.request()}>
            {signOut.busy ? <Spinner size={14} /> : <LogOut size={14} />} Sign out
          </button>
        </div>
      </section>

      <section className="account-card is-danger">
        <h3 className="account-card-title">Delete account</h3>
        <p className="account-card-hint">Permanently remove your account and all of your notes, folders and tags.</p>
        <div className="form-actions">
          <button type="button" className="btn btn-danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 size={14} /> Delete account…
          </button>
        </div>
      </section>

      <DeleteAccountDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onDeleted={onAccountDeleted} />
      <ConfirmDialog
        open={signOut.unsavedWarning}
        title="Unsaved changes"
        description="Some note changes couldn’t be saved. If you sign out now, they will be lost."
        confirmLabel="Sign out anyway"
        destructive
        onConfirm={signOut.confirmDiscard}
        onClose={signOut.cancelDiscard}
      />
    </div>
  );
}
