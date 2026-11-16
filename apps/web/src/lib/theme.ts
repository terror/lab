import { z } from 'zod';

import {
  readStored,
  subscribeStorage,
  usePersistentState,
  writeStored,
} from './storage';

const themeSchema = z.enum(['dark', 'light', 'system']);

export type Theme = z.infer<typeof themeSchema>;

const media = window.matchMedia('(prefers-color-scheme: dark)');

function readTheme() {
  return readStored<Theme>('theme', themeSchema, 'system');
}

function apply(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && media.matches);

  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

export function initTheme() {
  media.addEventListener('change', () => apply(readTheme()));
  subscribeStorage(() => apply(readTheme()));
  apply(readTheme());
}

export function setTheme(theme: Theme) {
  writeStored('theme', theme);
}

export function useTheme() {
  return usePersistentState<Theme>('theme', themeSchema, 'system')[0];
}
