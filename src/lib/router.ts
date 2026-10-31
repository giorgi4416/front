import { useSyncExternalStore } from 'react';

/** Minimal History API router — the app only has a handful of routes. */
const NAVIGATE_EVENT = 'app:navigate';

function subscribe(callback: () => void) {
  window.addEventListener('popstate', callback);
  window.addEventListener(NAVIGATE_EVENT, callback);
  return () => {
    window.removeEventListener('popstate', callback);
    window.removeEventListener(NAVIGATE_EVENT, callback);
  };
}

const getLocation = () => window.location.pathname + window.location.search;

export function useLocation(): { path: string; params: URLSearchParams } {
  const location = useSyncExternalStore(subscribe, getLocation);
  const url = new URL(location, window.location.origin);
  return { path: url.pathname.replace(/\/+$/, '') || '/', params: url.searchParams };
}

export function navigate(to: string, { replace = false } = {}) {
  if (to === getLocation()) return;
  if (replace) window.history.replaceState(null, '', to);
  else window.history.pushState(null, '', to);
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}

export const AUTH_ROUTES = ['/login', '/signup', '/forgot-password', '/reset-password'] as const;
