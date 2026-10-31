import type { ReactNode } from 'react';
import { FlaskConical, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Logo } from '../Logo';

interface AuthLayoutProps {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const { mode } = useAuth();
  return (
    <main className="auth-page">
      <div className="auth-stack">
        <div className="auth-card">
          <Logo />
          <div className="auth-heading">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="auth-body">{children}</div>
          {footer && <div className="auth-footer">{footer}</div>}
        </div>

        {mode === 'local' ? (
          <aside className="auth-mode is-demo" aria-label="Authentication mode">
            <FlaskConical size={16} aria-hidden />
            <p>
              <strong>Demo mode.</strong> Supabase isn’t configured, so accounts and notes are stored only in this
              browser. Passwords are hashed, but this is <em>not</em> production-secure authentication.
            </p>
          </aside>
        ) : (
          <aside className="auth-mode" aria-label="Authentication mode">
            <ShieldCheck size={16} aria-hidden />
            <p>Secured by Supabase Auth. Your notes are private to your account.</p>
          </aside>
        )}
      </div>
    </main>
  );
}
