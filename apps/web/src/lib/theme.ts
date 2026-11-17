import { useEffect } from 'react';

import { useMediaQuery } from './media';
import { type Preferences, usePreference } from './preferences';

export type Theme = Preferences['theme'];

export function useTheme() {
  return usePreference('theme');
}

export function useThemeClass() {
  const [theme] = useTheme();
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');

  const dark = theme === 'dark' || (theme === 'system' && prefersDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);
}
