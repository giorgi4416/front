import { forwardRef } from 'react';
import { CircleHelp, Menu as MenuIcon, Search, Settings, X } from 'lucide-react';
import { modKey } from '../lib/utils';
import { UserMenu } from './account/UserMenu';
import type { AccountTab } from './account/AccountDialog';
import { IconButton } from './ui/IconButton';

interface TopBarProps {
  title: string;
  query: string;
  onQueryChange: (query: string) => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onOpenNavigation: () => void;
  onOpenAccount: (tab: AccountTab) => void;
}

export const TopBar = forwardRef<HTMLInputElement, TopBarProps>(function TopBar(
  { title, query, onQueryChange, onOpenSettings, onOpenHelp, onOpenNavigation, onOpenAccount },
  searchRef,
) {
  return (
    <header className="topbar">
      <IconButton label="Open navigation" className="topbar-menu" onClick={onOpenNavigation}>
        <MenuIcon size={20} />
      </IconButton>
      <h1 className="topbar-title">{query ? <>Showing results for: <span className="topbar-query">{query}</span></> : title}</h1>
      <div className="topbar-actions">
        <div className="search" role="search">
          <Search size={20} className="search-icon" aria-hidden />
          <input
            ref={searchRef}
            type="search"
            className="search-input"
            placeholder="Search by title, content, or tags…"
            aria-label="Search notes"
            aria-keyshortcuts="Control+K Meta+K"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && query) {
                e.preventDefault();
                onQueryChange('');
              }
            }}
          />
          {query ? (
            <button type="button" className="search-clear icon-btn icon-btn-sm" aria-label="Clear search" onClick={() => onQueryChange('')}>
              <X size={14} />
            </button>
          ) : (
            <kbd className="search-kbd" aria-hidden>
              {modKey} K
            </kbd>
          )}
        </div>
        <IconButton label="Help & shortcuts" shortcut="?" onClick={onOpenHelp}>
          <CircleHelp size={20} />
        </IconButton>
        <IconButton label="Settings" onClick={onOpenSettings}>
          <Settings size={20} />
        </IconButton>
        <UserMenu onOpenAccount={onOpenAccount} onOpenSettings={onOpenSettings} />
      </div>
    </header>
  );
});
