import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { CircleUser, KeyRound, ShieldCheck } from 'lucide-react';
import { cx } from '../../lib/utils';
import { Dialog } from '../ui/Dialog';
import { AccountSection } from './AccountSection';
import { ProfileSection } from './ProfileSection';
import { SecuritySection } from './SecuritySection';

export type AccountTab = 'profile' | 'account' | 'security';

const TABS: { id: AccountTab; label: string; icon: ReactNode }[] = [
  { id: 'profile', label: 'Profile', icon: <CircleUser size={16} /> },
  { id: 'account', label: 'Email & Password', icon: <KeyRound size={16} /> },
  { id: 'security', label: 'Sessions & Security', icon: <ShieldCheck size={16} /> },
];

interface AccountDialogProps {
  open: boolean;
  initialTab: AccountTab;
  onClose: () => void;
}

export function AccountDialog({ open, initialTab, onClose }: AccountDialogProps) {
  const [tab, setTab] = useState<AccountTab>(initialTab);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = TABS.findIndex((t) => t.id === tab);
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = TABS[(index + delta + TABS.length) % TABS.length];
    setTab(next.id);
    document.getElementById(`account-tab-${next.id}`)?.focus();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Account" size="lg">
      <div className="account">
        <div className="account-tabs" role="tablist" aria-label="Account sections" aria-orientation="vertical" onKeyDown={onTabKeyDown}>
          {TABS.map((t) => (
            <button
              key={t.id}
              id={`account-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`account-panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              className={cx('account-tab', tab === t.id && 'is-active')}
              onClick={() => setTab(t.id)}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="account-panel" role="tabpanel" id={`account-panel-${tab}`} aria-labelledby={`account-tab-${tab}`}>
          {tab === 'profile' && <ProfileSection />}
          {tab === 'account' && <AccountSection />}
          {tab === 'security' && <SecuritySection onAccountDeleted={onClose} />}
        </div>
      </div>
    </Dialog>
  );
}
