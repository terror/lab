import { useEffect, useSyncExternalStore } from 'react';

import { useMediaQuery } from './media';
import { type Preferences, usePreference } from './preferences';

export type Theme = Preferences['theme'];

export function useTheme() {
  return usePreference('theme');
}

function subscribeDark(onChange: () => void) {
  const observer = new MutationObserver(onChange);

  observer.observe(document.documentElement, { attributeFilter: ['class'] });

  return () => observer.disconnect();
}

function isDark() {
  return document.documentElement.classList.contains('dark');
}

export function useDark() {
  return useSyncExternalStore(subscribeDark, isDark);
}

export function useThemeClass() {
  const [theme] = useTheme();
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');

  const dark = theme === 'dark' || (theme === 'system' && prefersDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);
}
