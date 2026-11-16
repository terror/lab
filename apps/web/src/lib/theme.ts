import { useEffect } from 'react';
import { z } from 'zod';

import { useMediaQuery } from './media';
import { usePersistentState } from './storage';

const themeSchema = z.enum(['dark', 'light', 'system']);

export type Theme = z.infer<typeof themeSchema>;

export function useTheme() {
  return usePersistentState('theme', themeSchema, 'system');
}

export function useThemeClass() {
  const [theme] = useTheme();
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');

  const dark = theme === 'dark' || (theme === 'system' && prefersDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);
}
