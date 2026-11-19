import { Computer } from '@/components/computer';
import { Connectors } from '@/components/connectors';
import { Memory } from '@/components/memory';
import { Profile } from '@/components/profile';
import { Providers } from '@/components/providers';
import { SettingRow } from '@/components/setting-row';
import { Skills } from '@/components/skills';
import { Trash } from '@/components/trash';
import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { Page, PageHeader } from '@/components/ui/page';
import { Pills } from '@/components/ui/pills';
import { Switch } from '@/components/ui/switch';
import { UsagePanel } from '@/components/usage';
import { type Preferences, usePreference } from '@/lib/preferences';
import {
  type SettingsSection,
  settingsSectionInfo,
  settingsSearchSchema,
  useSettingsSections,
} from '@/lib/settings';
import { type Theme, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { Link, useSearch } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ComponentType } from 'react';

const themes: { label: string; value: Theme }[] = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' },
];

const syntaxThemes: { label: string; value: Preferences['syntaxTheme'] }[] = [
  { label: 'Pierre', value: 'pierre' },
  { label: 'GitHub', value: 'github' },
  { label: 'Solarized', value: 'solarized' },
];

const personalities: {
  label: string;
  value: Preferences['personality'];
}[] = [
  { label: 'Default', value: 'default' },
  { label: 'Quiet', value: 'quiet' },
];

function Appearance() {
  const [theme, setTheme] = useTheme();
  const [syntaxTheme, setSyntaxTheme] = usePreference('syntaxTheme');
  const [lineNumbers, setLineNumbers] = usePreference('lineNumbers');
  const [personality, setPersonality] = usePreference('personality');

  return (
    <>
      <PageHeader
        description='Choose how Lab looks to you.'
        title='Appearance'
      />
      <ul className='flex flex-col gap-0.5'>
        <SettingRow
          control={
            <Pills
              label='Theme'
              onValueChange={setTheme}
              options={themes}
              value={theme}
            />
          }
          label='Theme'
        />
        <SettingRow
          control={
            <Pills
              label='Syntax highlighting'
              onValueChange={setSyntaxTheme}
              options={syntaxThemes}
              value={syntaxTheme}
            />
          }
          label='Syntax highlighting'
        />
        <SettingRow
          control={
            <Switch
              checked={lineNumbers}
              id='line-numbers'
              onCheckedChange={setLineNumbers}
            />
          }
          htmlFor='line-numbers'
          label='Line numbers in code blocks'
        />
        <SettingRow
          control={
            <Pills
              label='Personality'
              onValueChange={setPersonality}
              options={personalities}
              value={personality}
            />
          }
          description='How much Lab says beyond the facts.'
          label='Personality'
        />
      </ul>
    </>
  );
}

const panels: Record<SettingsSection, ComponentType> = {
  appearance: Appearance,
  computer: Computer,
  connectors: Connectors,
  memory: Memory,
  profile: Profile,
  providers: Providers,
  skills: Skills,
  trash: Trash,
  usage: UsagePanel,
};

function SettingsNav({
  current,
  sections,
}: {
  current: SettingsSection;
  sections: SettingsSection[];
}) {
  return (
    <nav
      aria-label='Settings'
      className='sticky top-0 hidden w-48 shrink-0 flex-col gap-0.5 self-start py-8 pl-4 @2xl:flex'
    >
      {sections.map((id) => {
        const { icon: Icon, label } = settingsSectionInfo[id];

        return (
          <Link
            key={id}
            aria-current={current === id ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-menu px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              current === id && 'bg-muted font-medium text-foreground'
            )}
            replace
            search={{ section: id }}
            to='/settings'
          >
            <Icon aria-hidden='true' className='size-4' />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function SettingsList({ sections }: { sections: SettingsSection[] }) {
  return (
    <Page className='@2xl:hidden'>
      <PageHeader title='Settings' />
      <nav aria-label='Settings'>
        <ul className='flex flex-col gap-0.5'>
          {sections.map((id) => {
            const { icon: Icon, label } = settingsSectionInfo[id];

            return (
              <ListRow key={id} asChild>
                <Link replace search={{ section: id }} to='/settings'>
                  <Icon
                    aria-hidden='true'
                    className='size-4 shrink-0 text-muted-foreground'
                  />
                  <span className='flex-1 truncate'>{label}</span>
                  <ChevronRight
                    aria-hidden='true'
                    className='size-4 shrink-0 text-muted-foreground'
                  />
                </Link>
              </ListRow>
            );
          })}
        </ul>
      </nav>
    </Page>
  );
}

export function Settings() {
  const requested = settingsSearchSchema.parse(
    useSearch({ strict: false })
  ).section;

  const sections = useSettingsSections();

  const section =
    requested && sections.includes(requested) ? requested : undefined;

  const Panel = panels[section ?? 'appearance'];

  return (
    <div className='@container min-h-0 flex-1 overflow-y-auto'>
      <div className='flex'>
        <SettingsNav current={section ?? 'appearance'} sections={sections} />
        {!section && <SettingsList sections={sections} />}
        <Page className={cn(!section && 'hidden @2xl:flex')}>
          <Button
            asChild
            className='-mb-4 -ml-2 self-start @2xl:hidden'
            size='sm'
            variant='quiet'
          >
            <Link replace to='/settings'>
              <ChevronLeft aria-hidden='true' />
              Settings
            </Link>
          </Button>
          <Panel />
        </Page>
      </div>
    </div>
  );
}
