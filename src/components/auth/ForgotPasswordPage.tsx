import { useState, type FormEvent } from 'react';
import { ArrowLeft, CircleAlert, FlaskConical, MailCheck } from 'lucide-react';
import { validateEmail } from '../../auth/backend';
import { useAuth } from '../../context/AuthContext';
import { navigate } from '../../lib/router';
import { errorMessage } from '../../lib/utils';
import { TextField } from '../ui/FormField';
import { Link } from '../ui/Link';
import { Spinner } from '../ui/Spinner';
import { AuthLayout } from './AuthLayout';

export function ForgotPasswordPage() {
  const { requestPasswordReset, mode } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ email: string; demoResetUrl?: string } | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const invalid = validateEmail(email);
    setError(invalid);
    setFormError(null);
    if (invalid) return;
    setBusy(true);
    try {
      const result = await requestPasswordReset(email);
      setSent({ email: email.trim(), demoResetUrl: result.demoResetUrl });
    } catch (err) {
      setFormError(errorMessage(err, 'Could not send the reset link.'));
    } finally {
      setBusy(false);
    }
  };

  const backToLogin = (
    <Link href="/login" className="link-text">
      <ArrowLeft size={14} aria-hidden /> Back to login
    </Link>
  );

  if (sent) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle={
          <>
            If an account exists for <strong>{sent.email}</strong>, we’ve sent a link to reset your password. The link
            expires in 30 minutes.
          </>
        }
        footer={backToLogin}
      >
        <div className="auth-success">
          <MailCheck size={28} aria-hidden />
        </div>
        {mode === 'local' && (
          <div className="demo-box">
            <div className="demo-box-title">
              <FlaskConical size={14} aria-hidden /> Demo mode — no email is sent
            </div>
            {sent.demoResetUrl ? (
              <>
                <p>In a real deployment this link would arrive by email:</p>
                <button
                  type="button"
                  className="btn btn-secondary btn-block"
                  onClick={() => navigate(new URL(sent.demoResetUrl!).pathname + new URL(sent.demoResetUrl!).search)}
                >
                  Open reset link
                </button>
              </>
            ) : (
              <p>No demo account uses this email address, so no reset link was created.</p>
            )}
          </div>
        )}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Forgotten your password?" subtitle="Enter your email below, and we’ll send you a link to reset it." footer={backToLogin}>
      <form className="form-stack" onSubmit={submit} noValidate>
        {formError && (
          <div className="form-alert" role="alert">
            <CircleAlert size={16} aria-hidden />
            <span>{formError}</span>
          </div>
        )}
        <TextField
          label="Email Address"
          type="email"
          autoComplete="email"
          placeholder="email@example.com"
          autoFocus
          value={email}
          error={error}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(validateEmail(e.target.value));
          }}
        />
        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy && <Spinner size={16} />}
          {busy ? 'Sending…' : 'Send Reset Link'}
        </button>
      </form>
    </AuthLayout>
  );
}
