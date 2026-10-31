import { useEffect, type ComponentType } from 'react';
import { ForgotPasswordPage } from './components/auth/ForgotPasswordPage';
import { LoginPage } from './components/auth/LoginPage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { SignupPage } from './components/auth/SignupPage';
import { Workspace } from './components/Workspace';
import { Spinner } from './components/ui/Spinner';
import { useAuth } from './context/AuthContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { navigate, useLocation } from './lib/router';

const PUBLIC_PAGES: Record<string, ComponentType> = {
  '/login': LoginPage,
  '/signup': SignupPage,
  '/forgot-password': ForgotPasswordPage,
};

function Redirect({ to }: { to: string }) {
  useEffect(() => navigate(to, { replace: true }), [to]);
  return null;
}

export default function App() {
  const { status, user, recovery } = useAuth();
  const { path } = useLocation();

  if (status === 'loading') {
    return (
      <div className="splash">
        <Spinner size={24} label="Loading" />
      </div>
    );
  }

  // Reset links work whether or not a session exists (Supabase recovery links create one).
  if (path === '/reset-password' || recovery) {
    return path === '/reset-password' ? <ResetPasswordPage /> : <Redirect to="/reset-password" />;
  }

  const PublicPage = PUBLIC_PAGES[path];
  if (PublicPage) return user ? <Redirect to="/" /> : <PublicPage />;

  // Everything else is the protected app.
  if (!user) return <Redirect to="/login" />;
  if (path !== '/') return <Redirect to="/" />;

  return (
    <WorkspaceProvider key={user.id} user={user}>
      <Workspace />
    </WorkspaceProvider>
  );
}
