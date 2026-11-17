import { useEffect } from 'react';

import { useMediaQuery } from './media';
import { type Preferences, usePreference } from './preferences';

export type Theme = Preferences['theme'];

export function useTheme() {
  return usePreference('theme');
}

export function useDark() {
  const [theme] = useTheme();
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');

  return theme === 'dark' || (theme === 'system' && prefersDark);
}

export function useThemeClass() {
  const dark = useDark();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);
}
