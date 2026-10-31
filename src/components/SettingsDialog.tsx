import type { ReactNode } from 'react';
import { Cloud, Download, HardDrive, Monitor, Moon, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { useWorkspace } from '../context/WorkspaceContext';
import { cx } from '../lib/utils';
import type { ColorTheme, FontTheme } from '../types';
import { Dialog } from './ui/Dialog';

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; icon?: ReactNode; sample?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={cx('segmented-option', value === option.value && 'is-active')}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.sample && <span className={`font-sample font-${option.value}`}>{option.sample}</span>}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { colorTheme, fontTheme, setColorTheme, setFontTheme } = usePreferences();
  const { mode, user } = useAuth();
  const { notes, folders, tags } = useWorkspace();

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), notes, folders, tags }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `notes-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onClose={onClose} title="Settings" size="md">
      <div className="settings">
        <section className="settings-section">
          <h3 className="settings-heading">Color theme</h3>
          <p className="settings-hint">Choose your interface color theme.</p>
          <Segmented<ColorTheme>
            label="Color theme"
            value={colorTheme}
            onChange={setColorTheme}
            options={[
              { value: 'dark', label: 'Dark', icon: <Moon size={16} /> },
              { value: 'light', label: 'Light', icon: <Sun size={16} /> },
              { value: 'system', label: 'System', icon: <Monitor size={16} /> },
            ]}
          />
        </section>

        <section className="settings-section">
          <h3 className="settings-heading">Font theme</h3>
          <p className="settings-hint">Choose the typeface used throughout the app.</p>
          <Segmented<FontTheme>
            label="Font theme"
            value={fontTheme}
            onChange={setFontTheme}
            options={[
              { value: 'sans', label: 'Sans-serif', sample: 'Aa' },
              { value: 'serif', label: 'Serif', sample: 'Aa' },
              { value: 'mono', label: 'Monospace', sample: 'Aa' },
            ]}
          />
        </section>

        <section className="settings-section">
          <h3 className="settings-heading">Storage</h3>
          <div className={cx('storage-card', mode === 'local' && 'is-local')}>
            {mode === 'local' ? <HardDrive size={18} aria-hidden /> : <Cloud size={18} aria-hidden />}
            <div>
              <strong>{mode === 'local' ? 'Demo mode' : 'Synced with Supabase'}</strong>
              <p>
                {mode === 'local'
                  ? 'Supabase is not configured, so your demo account and notes are stored only in this browser. Clearing site data deletes them.'
                  : `Signed in as ${user?.email}. Notes are stored in your Supabase database.`}
              </p>
            </div>
          </div>
          <button type="button" className="btn btn-secondary" onClick={exportData}>
            <Download size={16} /> Export notes as JSON
          </button>
        </section>
      </div>
    </Dialog>
  );
}
