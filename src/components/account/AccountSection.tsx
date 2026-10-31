import { useState, type ChangeEvent, type FormEvent } from 'react';
import { MailWarning } from 'lucide-react';
import { AuthError, validateEmail, validatePassword } from '../../auth/backend';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { errorMessage } from '../../lib/utils';
import { PasswordField, TextField } from '../ui/FormField';
import { Spinner } from '../ui/Spinner';

type Errors = Record<string, string | null | undefined>;

function ChangeEmailForm() {
  const { user, updateEmail } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next = { email: validateEmail(email), currentPassword: password ? null : 'Enter your current password.' };
    setErrors(next);
    if (next.email || next.currentPassword) return;
    setBusy(true);
    try {
      const { needsConfirmation } = await updateEmail(email, password);
      setEmail('');
      setPassword('');
      toast.success(
        needsConfirmation ? 'Check both inboxes to confirm the change of email address.' : 'Email address updated.',
      );
    } catch (error) {
      const field = error instanceof AuthError ? error.field : undefined;
      setErrors({ [field ?? 'form']: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="account-card">
      <h3 className="account-card-title">Email address</h3>
      <p className="account-card-hint">
        You currently sign in with <strong>{user?.email}</strong>.
      </p>
      {user?.pendingEmail && (
        <div className="notice">
          <MailWarning size={16} aria-hidden />
          <span>
            Waiting for confirmation of <strong>{user.pendingEmail}</strong>. Follow the link we emailed to finish.
          </span>
        </div>
      )}
      <form className="form-stack" onSubmit={submit} noValidate>
        <TextField
          label="New email address"
          type="email"
          autoComplete="email"
          placeholder="new@example.com"
          value={email}
          error={errors.email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField
          label="Current password"
          autoComplete="current-password"
          value={password}
          error={errors.currentPassword}
          onChange={(e) => setPassword(e.target.value)}
        />
        {errors.form && (
          <p className="form-error" role="alert">
            {errors.form}
          </p>
        )}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy && <Spinner size={14} />} Update email
          </button>
        </div>
      </form>
    </section>
  );
}

function ChangePasswordForm() {
  const { updatePassword } = useAuth();
  const toast = useToast();
  const [values, setValues] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Errors = {
      currentPassword: values.current ? null : 'Enter your current password.',
      password:
        validatePassword(values.next) ??
        (values.next === values.current ? 'Your new password must be different from the current one.' : null),
      confirm: values.confirm !== values.next ? 'Passwords don’t match.' : null,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    setBusy(true);
    try {
      await updatePassword(values.current, values.next);
      setValues({ current: '', next: '', confirm: '' });
      toast.success('Password changed.');
    } catch (error) {
      const field = error instanceof AuthError ? error.field : undefined;
      setErrors({ [field ?? 'form']: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const set = (key: keyof typeof values) => (e: ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  return (
    <section className="account-card">
      <h3 className="account-card-title">Change password</h3>
      <p className="account-card-hint">Use at least 8 characters, including a letter and a number.</p>
      <form className="form-stack" onSubmit={submit} noValidate>
        <PasswordField
          label="Current password"
          autoComplete="current-password"
          value={values.current}
          error={errors.currentPassword}
          onChange={set('current')}
        />
        <PasswordField
          label="New password"
          autoComplete="new-password"
          showStrength
          value={values.next}
          error={errors.password}
          onChange={set('next')}
        />
        <PasswordField
          label="Confirm new password"
          autoComplete="new-password"
          value={values.confirm}
          error={errors.confirm}
          onChange={set('confirm')}
        />
        {errors.form && (
          <p className="form-error" role="alert">
            {errors.form}
          </p>
        )}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy && <Spinner size={14} />} Change password
          </button>
        </div>
      </form>
    </section>
  );
}

export function AccountSection() {
  return (
    <div className="account-sections">
      <ChangeEmailForm />
      <ChangePasswordForm />
    </div>
  );
}
