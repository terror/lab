import { useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light' | 'system';

const key = 'lab-theme';

const media = window.matchMedia('(prefers-color-scheme: dark)');

const listeners = new Set<() => void>();

function read(): Theme {
  const value = window.localStorage.getItem(key);

  if (value === 'dark' || value === 'light') {
    return value;
  }

  return 'system';
}

function apply(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && media.matches);

  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function initTheme() {
  media.addEventListener('change', () => apply(read()));
  apply(read());
}

export function setTheme(theme: Theme) {
  window.localStorage.setItem(key, theme);
  apply(theme);

  for (const listener of listeners) {
    listener();
  }
}

export function useTheme() {
  return useSyncExternalStore(subscribe, read);
}
