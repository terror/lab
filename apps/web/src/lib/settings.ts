import { useAdmin } from '@/lib/profile';
import { usePersistentState, writeStored } from '@/lib/storage';
import {
  Brain,
  Gauge,
  KeyRound,
  type LucideIcon,
  Monitor,
  Palette,
  Plug,
  Trash2,
  UserRound,
  WandSparkles,
} from 'lucide-react';
import { z } from 'zod';

export const settingsSections = [
  'appearance',
  'profile',
  'computer',
  'connectors',
  'memory',
  'skills',
  'providers',
  'usage',
  'trash',
] as const;

export type SettingsSection = (typeof settingsSections)[number];

export const settingsSectionInfo: Record<
  SettingsSection,
  { icon: LucideIcon; label: string }
> = {
  appearance: { icon: Palette, label: 'Appearance' },
  computer: { icon: Monitor, label: 'Computer' },
  connectors: { icon: Plug, label: 'Connectors' },
  memory: { icon: Brain, label: 'Memory' },
  profile: { icon: UserRound, label: 'Profile' },
  providers: { icon: KeyRound, label: 'Providers' },
  skills: { icon: WandSparkles, label: 'Skills' },
  trash: { icon: Trash2, label: 'Trash' },
  usage: { icon: Gauge, label: 'Usage' },
};

const adminSections = new Set<SettingsSection>(['providers']);

export function useSettingsSections() {
  const admin = useAdmin();

  return settingsSections.filter(
    (section) => admin || !adminSections.has(section)
  );
}

const KEY = 'settings-section';

const schema = z.enum(settingsSections);

export function useSettingsSection() {
  return usePersistentState(KEY, schema, 'appearance');
}

export function selectSettingsSection(section: SettingsSection) {
  writeStored(KEY, section);
}
