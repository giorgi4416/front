import { useEffect, useState, type FormEvent } from 'react';
import { CircleAlert, LinkIcon } from 'lucide-react';
import { validatePassword } from '../../auth/backend';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { navigate, useLocation } from '../../lib/router';
import { errorMessage } from '../../lib/utils';
import { PasswordField } from '../ui/FormField';
import { Link } from '../ui/Link';
import { Spinner } from '../ui/Spinner';
import { AuthLayout } from './AuthLayout';

export function ResetPasswordPage() {
  const { canResetPassword, completePasswordReset, clearRecovery, mode } = useAuth();
  const toast = useToast();
  const { params } = useLocation();
  const token = params.get('token');
  const [valid, setValid] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string | null; confirm?: string | null; form?: string | null }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    canResetPassword(token).then((ok) => active && setValid(ok));
    return () => {
      active = false;
    };
  }, [canResetPassword, token]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next = {
      password: validatePassword(password),
      confirm: !confirm ? 'Please confirm your new password.' : confirm !== password ? 'Passwords don’t match.' : null,
    };
    setErrors(next);
    if (next.password || next.confirm) return;
    setBusy(true);
    try {
      await completePasswordReset(password, token);
      clearRecovery();
      if (mode === 'local') {
        toast.success('Password updated. Log in with your new password.');
        navigate('/login', { replace: true });
      } else {
        toast.success('Password updated. You’re signed in.');
        navigate('/', { replace: true });
      }
    } catch (err) {
      setErrors({ form: errorMessage(err, 'Could not reset your password.') });
      setBusy(false);
    }
  };

  if (valid === null) {
    return (
      <div className="splash">
        <Spinner size={24} label="Checking reset link" />
      </div>
    );
  }

  if (!valid) {
    return (
      <AuthLayout
        title="Link expired"
        subtitle="This password reset link is invalid or has expired. Reset links can only be used once and last 30 minutes."
        footer={
          <Link href="/login" className="link-text">
            Back to login
          </Link>
        }
      >
        <div className="auth-success is-muted">
          <LinkIcon size={28} aria-hidden />
        </div>
        <Link href="/forgot-password" className="btn btn-primary btn-block btn-lg">
          Request a new link
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset Your Password" subtitle="Choose a new password to secure your account.">
      <form className="form-stack" onSubmit={submit} noValidate>
        {errors.form && (
          <div className="form-alert" role="alert">
            <CircleAlert size={16} aria-hidden />
            <span>{errors.form}</span>
          </div>
        )}
        <PasswordField
          label="New Password"
          autoComplete="new-password"
          autoFocus
          showStrength
          value={password}
          error={errors.password}
          hint="At least 8 characters, with a letter and a number."
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordField
          label="Confirm New Password"
          autoComplete="new-password"
          value={confirm}
          error={errors.confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy && <Spinner size={16} />}
          {busy ? 'Saving…' : 'Reset Password'}
        </button>
      </form>
    </AuthLayout>
  );
}
