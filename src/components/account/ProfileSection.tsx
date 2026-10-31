import { useRef, useState, type FormEvent } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { prepareAvatar } from '../../lib/image';
import { errorMessage, formatDate, formatDateTime } from '../../lib/utils';
import { TextField } from '../ui/FormField';
import { Spinner } from '../ui/Spinner';
import { Avatar } from './Avatar';

export function ProfileSection() {
  const { user, mode, updateProfile } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'name' | 'avatar' | null>(null);

  if (!user) return null;

  const saveName = async (event: FormEvent) => {
    event.preventDefault();
    if (displayName.trim().length > 60) return setNameError('Keep your name under 60 characters.');
    setNameError(null);
    setBusy('name');
    try {
      await updateProfile({ displayName });
      toast.success('Profile updated.');
    } catch (error) {
      setNameError(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const changeAvatar = async (file: File | null) => {
    setBusy('avatar');
    try {
      await updateProfile({ avatar: file ? await prepareAvatar(file) : null });
      toast.success(file ? 'Profile photo updated.' : 'Profile photo removed.');
    } catch (error) {
      toast.error(errorMessage(error, 'The photo could not be updated.'));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="account-sections">
      <section className="account-card">
        <div className="profile-hero">
          <div className="profile-avatar">
            <Avatar user={user} size={72} />
            {busy === 'avatar' && (
              <span className="profile-avatar-busy">
                <Spinner size={20} label="Uploading photo" />
              </span>
            )}
          </div>
          <div className="profile-hero-text">
            <h3>{user.displayName || 'No display name yet'}</h3>
            <p>{user.email}</p>
            <div className="profile-hero-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
                <Camera size={14} /> {user.avatarUrl ? 'Change photo' : 'Upload photo'}
              </button>
              {user.avatarUrl && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void changeAvatar(null)} disabled={busy !== null}>
                  <Trash2 size={14} /> Remove
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="visually-hidden"
              tabIndex={-1}
              aria-label="Upload profile photo"
              onChange={(e) => void changeAvatar(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
      </section>

      <section className="account-card">
        <h3 className="account-card-title">Display name</h3>
        <p className="account-card-hint">Shown in the header and your account menu.</p>
        <form className="inline-form" onSubmit={saveName} noValidate>
          <TextField
            label="Display name"
            placeholder="Your name"
            maxLength={60}
            value={displayName}
            error={nameError}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={busy !== null || displayName.trim() === user.displayName}>
            {busy === 'name' && <Spinner size={14} />} Save
          </button>
        </form>
      </section>

      <section className="account-card">
        <h3 className="account-card-title">Account information</h3>
        <dl className="info-list">
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Member since</dt>
            <dd>{formatDate(user.createdAt)}</dd>
          </div>
          <div>
            <dt>Last sign-in</dt>
            <dd>{user.lastSignInAt ? formatDateTime(user.lastSignInAt) : '—'}</dd>
          </div>
          <div>
            <dt>Authentication</dt>
            <dd>{mode === 'local' ? 'Demo account (this browser only)' : 'Supabase Auth · email & password'}</dd>
          </div>
          <div>
            <dt>Account ID</dt>
            <dd className="mono">{user.id}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
