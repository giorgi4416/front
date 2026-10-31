import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { CircleAlert, Eye, EyeOff } from 'lucide-react';
import { passwordStrength } from '../../auth/backend';
import { cx } from '../../lib/utils';

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  error?: string | null;
  hint?: ReactNode;
  /** Rendered on the right of the label row, e.g. a "Forgot password?" link. */
  labelAction?: ReactNode;
}

function FieldShell({
  id,
  label,
  error,
  hint,
  labelAction,
  children,
}: {
  id: string;
  label: string;
  error?: string | null;
  hint?: ReactNode;
  labelAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={cx('field', error && 'has-error')}>
      <div className="field-label-row">
        <label htmlFor={id} className="field-label">
          {label}
        </label>
        {labelAction}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="field-error" role="alert">
          <CircleAlert size={14} aria-hidden /> {error}
        </p>
      ) : (
        hint && (
          <div id={`${id}-hint`} className="field-hint">
            {hint}
          </div>
        )
      )}
    </div>
  );
}

const describedBy = (id: string, error?: string | null, hint?: ReactNode) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

export const TextField = forwardRef<HTMLInputElement, FieldProps>(function TextField(
  { label, error, hint, labelAction, className, ...input },
  ref,
) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} error={error} hint={hint} labelAction={labelAction}>
      <input
        ref={ref}
        id={id}
        className={cx('input', className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...input}
      />
    </FieldShell>
  );
});

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];

export const PasswordField = forwardRef<HTMLInputElement, FieldProps & { showStrength?: boolean }>(function PasswordField(
  { label, error, hint, labelAction, showStrength, value, ...input },
  ref,
) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const strength = showStrength ? passwordStrength(String(value ?? '')) : 0;

  return (
    <FieldShell id={id} label={label} error={error} hint={hint} labelAction={labelAction}>
      <span className="input-with-action">
        <input
          ref={ref}
          id={id}
          className="input"
          type={visible ? 'text' : 'password'}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          {...input}
        />
        <button
          type="button"
          className="icon-btn icon-btn-sm"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </span>
      {showStrength && String(value ?? '').length > 0 && (
        <div className="strength" data-strength={strength} aria-live="polite">
          <span className="strength-bars" aria-hidden>
            {[1, 2, 3, 4].map((n) => (
              <span key={n} className={cx('strength-bar', n <= strength && 'is-on')} />
            ))}
          </span>
          <span className="strength-label">Password strength: {STRENGTH_LABELS[strength]}</span>
        </div>
      )}
    </FieldShell>
  );
});
