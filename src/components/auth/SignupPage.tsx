import { useState, type ChangeEvent, type FormEvent } from 'react';
import { CircleAlert, MailCheck } from 'lucide-react';
import { AuthError, validateEmail, validatePassword } from '../../auth/backend';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { navigate } from '../../lib/router';
import { errorMessage } from '../../lib/utils';
import { PasswordField, TextField } from '../ui/FormField';
import { Link } from '../ui/Link';
import { Spinner } from '../ui/Spinner';
import { AuthLayout } from './AuthLayout';

interface Values {
  displayName: string;
  email: string;
  password: string;
  confirm: string;
}
type Errors = Partial<Record<keyof Values | 'form', string | null>>;

function validate(v: Values): Errors {
  return {
    displayName: v.displayName.trim().length > 60 ? 'Keep your name under 60 characters.' : null,
    email: validateEmail(v.email),
    password: validatePassword(v.password),
    confirm: !v.confirm ? 'Please confirm your password.' : v.confirm !== v.password ? 'Passwords don’t match.' : null,
  };
}

const hasErrors = (e: Errors) => Object.values(e).some(Boolean);

export function SignupPage() {
  const { signUp } = useAuth();
  const toast = useToast();
  const [values, setValues] = useState<Values>({ displayName: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);

  const set = (key: keyof Values) => (e: ChangeEvent<HTMLInputElement>) => {
    const next = { ...values, [key]: e.target.value };
    setValues(next);
    if (submitted) setErrors(validate(next));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    const next = validate(values);
    setErrors(next);
    if (hasErrors(next)) return;
    setBusy(true);
    try {
      const { needsConfirmation } = await signUp(values.email, values.password, values.displayName);
      if (needsConfirmation) {
        setConfirmationSentTo(values.email.trim());
        setBusy(false);
        return;
      }
      toast.success(`Welcome${values.displayName.trim() ? `, ${values.displayName.trim()}` : ''}! Your account is ready.`);
      navigate('/', { replace: true });
    } catch (error) {
      const field = error instanceof AuthError ? error.field : undefined;
      const message = errorMessage(error, 'Could not create your account.');
      setErrors(field && field !== 'currentPassword' ? { [field]: message } : { form: message });
      setBusy(false);
    }
  };

  if (confirmationSentTo) {
    return (
      <AuthLayout
        title="Check your inbox"
        subtitle={
          <>
            We sent a confirmation link to <strong>{confirmationSentTo}</strong>. Open it to activate your account, then
            log in.
          </>
        }
        footer={
          <>
            Already confirmed? <Link href="/login" className="link-text">Login</Link>
          </>
        }
      >
        <div className="auth-success">
          <MailCheck size={28} aria-hidden />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create Your Account"
      subtitle="Sign up to start organizing your notes and boost your productivity."
      footer={
        <>
          Already have an account? <Link href="/login" className="link-text">Login</Link>
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
          label="Display Name"
          autoComplete="name"
          placeholder="How should we call you? (optional)"
          autoFocus
          maxLength={60}
          value={values.displayName}
          error={errors.displayName}
          onChange={set('displayName')}
        />
        <TextField
          label="Email Address"
          type="email"
          autoComplete="email"
          placeholder="email@example.com"
          value={values.email}
          error={errors.email}
          onChange={set('email')}
        />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          showStrength
          value={values.password}
          error={errors.password}
          hint="At least 8 characters, with a letter and a number."
          onChange={set('password')}
        />
        <PasswordField
          label="Confirm Password"
          autoComplete="new-password"
          value={values.confirm}
          error={errors.confirm}
          onChange={set('confirm')}
        />
        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy && <Spinner size={16} />}
          {busy ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
    </AuthLayout>
  );
}
