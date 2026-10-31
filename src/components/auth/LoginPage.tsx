import { useState, type FormEvent } from 'react';
import { CircleAlert } from 'lucide-react';
import { AuthError, validateEmail } from '../../auth/backend';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { navigate } from '../../lib/router';
import { errorMessage } from '../../lib/utils';
import { PasswordField, TextField } from '../ui/FormField';
import { Link } from '../ui/Link';
import { Spinner } from '../ui/Spinner';
import { AuthLayout } from './AuthLayout';

type Errors = { email?: string | null; password?: string | null; form?: string | null };

function validate(email: string, password: string): Errors {
  return { email: validateEmail(email), password: password ? null : 'Password is required.' };
}

export function LoginPage() {
  const { signIn } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    const next = validate(email, password);
    setErrors(next);
    if (next.email || next.password) return;
    setBusy(true);
    try {
      await signIn(email, password);
      toast.success('Welcome back!');
      navigate('/', { replace: true });
    } catch (error) {
      const field = error instanceof AuthError ? error.field : undefined;
      const message = errorMessage(error, 'Could not log in.');
      setErrors(field === 'email' ? { email: message } : { form: message });
      setBusy(false);
    }
  };

  const revalidate = (nextEmail: string, nextPassword: string) => {
    if (submitted) setErrors(validate(nextEmail, nextPassword));
  };

  return (
    <AuthLayout
      title="Welcome to Notes"
      subtitle="Please log in to continue"
      footer={
        <>
          No account yet? <Link href="/signup" className="link-text">Sign up</Link>
        </>
      }
    >
      <form className="form-stack" onSubmit={submit} noValidate>
        {errors.form && (
          <div className="form-alert" role="alert">
            <CircleAlert size={16} aria-hidden />
            <span>{errors.form}</span>
          </div>
        )}
        <TextField
          label="Email Address"
          type="email"
          autoComplete="email"
          placeholder="email@example.com"
          autoFocus
          value={email}
          error={errors.email}
          onChange={(e) => {
            setEmail(e.target.value);
            revalidate(e.target.value, password);
          }}
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          value={password}
          error={errors.password}
          labelAction={
            <Link href="/forgot-password" className="field-link">
              Forgot password?
            </Link>
          }
          onChange={(e) => {
            setPassword(e.target.value);
            revalidate(email, e.target.value);
          }}
        />
        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy && <Spinner size={16} />}
          {busy ? 'Logging in…' : 'Login'}
        </button>
      </form>
    </AuthLayout>
  );
}
