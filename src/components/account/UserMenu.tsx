import { CircleUser, LogOut, Settings, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSignOut } from '../../hooks/useSignOut';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Menu } from '../ui/Menu';
import { Avatar } from './Avatar';
import type { AccountTab } from './AccountDialog';

interface UserMenuProps {
  onOpenAccount: (tab: AccountTab) => void;
  onOpenSettings: () => void;
}

export function UserMenu({ onOpenAccount, onOpenSettings }: UserMenuProps) {
  const { user, mode } = useAuth();
  const signOut = useSignOut();
  if (!user) return null;

  return (
    <>
      <Menu
        label="Account menu"
        align="end"
        header={
          <div className="user-menu-header">
            <Avatar user={user} size={40} />
            <div className="user-menu-identity">
              <strong>{user.displayName || user.email.split('@')[0]}</strong>
              <span>{user.email}</span>
              {mode === 'local' && <span className="badge-demo">Demo account</span>}
            </div>
          </div>
        }
        items={[
          { label: 'My Profile', icon: <CircleUser size={16} />, onSelect: () => onOpenAccount('profile') },
          { label: 'Settings', icon: <Settings size={16} />, onSelect: onOpenSettings },
          { label: 'Account', icon: <ShieldCheck size={16} />, onSelect: () => onOpenAccount('account') },
          'separator',
          { label: 'Sign Out', icon: <LogOut size={16} />, onSelect: () => void signOut.request(), disabled: signOut.busy },
        ]}
        trigger={(props) => (
          <button type="button" className="avatar-trigger" aria-label={`Account menu for ${user.email}`} {...props}>
            <Avatar user={user} size={36} />
          </button>
        )}
      />
      <ConfirmDialog
        open={signOut.unsavedWarning}
        title="Unsaved changes"
        description="Some note changes couldn’t be saved. If you sign out now, they will be lost."
        confirmLabel="Sign out anyway"
        destructive
        onConfirm={signOut.confirmDiscard}
        onClose={signOut.cancelDiscard}
      />
    </>
  );
}
