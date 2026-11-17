import { usePersistentState, writeStored } from '@/lib/storage';
import { z } from 'zod';

export const settingsSections = [
  'appearance',
  'profile',
  'computer',
  'memory',
  'skills',
  'providers',
  'usage',
  'trash',
] as const;

export type SettingsSection = (typeof settingsSections)[number];

const KEY = 'settings-section';

const schema = z.enum(settingsSections);

export function useSettingsSection() {
  return usePersistentState(KEY, schema, 'appearance');
}

export function selectSettingsSection(section: SettingsSection) {
  writeStored(KEY, section);
}
