import { useEffect, useState, type FormEvent } from 'react';
import { Dialog } from './Dialog';
import { Spinner } from './Spinner';

export interface PromptField {
  name: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'url';
  required?: boolean;
  initialValue?: string;
  maxLength?: number;
}

interface PromptDialogProps {
  open: boolean;
  title: string;
  description?: string;
  fields: PromptField[];
  submitLabel: string;
  onSubmit: (values: Record<string, string>) => Promise<boolean | void> | boolean | void;
  onClose: () => void;
}

/** Small form dialog used for naming folders/tags and entering link or image URLs. */
export function PromptDialog({ open, title, description, fields, submitLabel, onSubmit, onClose }: PromptDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValues(Object.fromEntries(fields.map((f) => [f.name, f.initialValue ?? ''])));
      setError(null);
    }
    // Reset only when the dialog opens, not when the caller re-renders with new field objects.
  }, [open]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    for (const field of fields) {
      const value = (values[field.name] ?? '').trim();
      if (field.required && !value) return setError(`${field.label} is required.`);
      if (field.type === 'url' && value && !/^(https?:\/\/|mailto:)/i.test(value)) {
        return setError('Enter a full URL starting with https:// or http://');
      }
    }
    setBusy(true);
    try {
      const trimmed = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]));
      const result = await onSubmit(trimmed);
      if (result !== false) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      <form onSubmit={submit} className="form-stack" noValidate>
        {fields.map((field, index) => (
          <label key={field.name} className="field">
            <span className="field-label">{field.label}</span>
            <input
              className="input"
              type={field.type ?? 'text'}
              placeholder={field.placeholder}
              value={values[field.name] ?? ''}
              maxLength={field.maxLength}
              data-autofocus={index === 0 ? true : undefined}
              onChange={(e) => {
                setError(null);
                setValues((v) => ({ ...v, [field.name]: e.target.value }));
              }}
            />
          </label>
        ))}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy && <Spinner size={14} />}
            {submitLabel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
