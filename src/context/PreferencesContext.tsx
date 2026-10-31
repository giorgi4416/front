import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ColorTheme, FontTheme } from '../types';

interface Preferences {
  colorTheme: ColorTheme;
  fontTheme: FontTheme;
  setColorTheme: (theme: ColorTheme) => void;
  setFontTheme: (font: FontTheme) => void;
}

const STORAGE_KEY = 'notes-app:preferences';

function readStored(): { colorTheme: ColorTheme; fontTheme: FontTheme } {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return {
      colorTheme: ['dark', 'light', 'system'].includes(parsed.colorTheme) ? parsed.colorTheme : 'dark',
      fontTheme: ['sans', 'serif', 'mono'].includes(parsed.fontTheme) ? parsed.fontTheme : 'sans',
    };
  } catch {
    return { colorTheme: 'dark', fontTheme: 'sans' };
  }
}

const PreferencesContext = createContext<Preferences | null>(null);

/** Per-device display preferences (theme and font), stored in localStorage. */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* storage unavailable — preferences just won't persist */
    }
    const root = document.documentElement;
    root.dataset.font = prefs.fontTheme;
    if (prefs.colorTheme !== 'system') {
      root.dataset.theme = prefs.colorTheme;
      return;
    }
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => (root.dataset.theme = media.matches ? 'light' : 'dark');
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [prefs]);

  const value = useMemo<Preferences>(
    () => ({
      ...prefs,
      setColorTheme: (colorTheme) => setPrefs((p) => ({ ...p, colorTheme })),
      setFontTheme: (fontTheme) => setPrefs((p) => ({ ...p, fontTheme })),
    }),
    [prefs],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): Preferences {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider');
  return ctx;
}
