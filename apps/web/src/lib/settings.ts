import { useAdmin } from '@/lib/profile';
import {
  Brain,
  Cable,
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
  'mcp',
  'memory',
  'skills',
  'providers',
  'usage',
  'trash',
] as const;

export type SettingsSection = (typeof settingsSections)[number];

export const settingsSectionInfo: Record<
  SettingsSection,
  { admin?: true; icon: LucideIcon; label: string }
> = {
  appearance: { icon: Palette, label: 'Appearance' },
  computer: { icon: Monitor, label: 'Computer' },
  connectors: { icon: Plug, label: 'Connectors' },
  mcp: { icon: Cable, label: 'MCP' },
  memory: { icon: Brain, label: 'Memory' },
  profile: { icon: UserRound, label: 'Profile' },
  providers: { admin: true, icon: KeyRound, label: 'Providers' },
  skills: { icon: WandSparkles, label: 'Skills' },
  trash: { icon: Trash2, label: 'Trash' },
  usage: { icon: Gauge, label: 'Usage' },
};

export function useSettingsSections() {
  const admin = useAdmin();

  return settingsSections.filter(
    (section) => admin || !settingsSectionInfo[section].admin
  );
}

export const settingsSearchSchema = z.object({
  section: z.enum(settingsSections).optional().catch(undefined),
});
