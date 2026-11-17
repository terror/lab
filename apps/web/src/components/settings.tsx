import { Computer } from '@/components/computer';
import { Connectors } from '@/components/connectors';
import { Memory } from '@/components/memory';
import { Profile } from '@/components/profile';
import { Providers } from '@/components/providers';
import { SettingsPage } from '@/components/settings-page';
import { Skills } from '@/components/skills';
import { Trash } from '@/components/trash';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { UsagePanel } from '@/components/usage';
import { usePreference } from '@/lib/preferences';
import {
  type SettingsSection,
  settingsSectionInfo,
  useSettingsSection,
  useSettingsSections,
} from '@/lib/settings';
import { type Theme, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import type { ComponentType } from 'react';

const themes: { label: string; value: Theme }[] = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' },
];

function Appearance() {
  const [theme, setTheme] = useTheme();
  const [lineNumbers, setLineNumbers] = usePreference('lineNumbers');

  const label = themes.find(({ value }) => value === theme)?.label ?? 'System';

  return (
    <SettingsPage description='Choose how Lab looks to you.' title='Appearance'>
      <div className='flex items-center justify-between gap-4'>
        <span className='text-sm'>Theme</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className='flex items-center gap-1 text-sm text-muted-foreground outline-none'
              type='button'
            >
              {label}
              <ChevronDown aria-hidden='true' className='size-4' />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuRadioGroup
              onValueChange={(value) => {
                const choice = themes.find(
                  (candidate) => candidate.value === value
                );

                if (choice) {
                  setTheme(choice.value);
                }
              }}
              value={theme}
            >
              {themes.map(({ label: name, value }) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  {name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className='flex items-center justify-between gap-4'>
        <label className='text-sm' htmlFor='line-numbers'>
          Line numbers in code blocks
        </label>
        <Switch
          checked={lineNumbers}
          id='line-numbers'
          onCheckedChange={setLineNumbers}
        />
      </div>
    </SettingsPage>
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

export function Settings() {
  const [stored, setSection] = useSettingsSection();
  const sections = useSettingsSections();

  const section = sections.includes(stored) ? stored : 'appearance';

  const Panel = panels[section];
  const router = useRouter();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();

  const back = () => {
    if (canGoBack) {
      router.history.back();
    } else {
      void navigate({ to: '/' });
    }
  };

  return (
    <div className='flex min-h-svh flex-col'>
      <header className='px-4 py-3'>
        <Button onClick={back} variant='ghost'>
          <ArrowLeft aria-hidden='true' />
          Back to chat
        </Button>
      </header>
      <div className='flex w-full flex-1 flex-col gap-8 px-4 pb-8 sm:flex-row sm:gap-12'>
        <nav
          aria-label='Settings'
          className='flex shrink-0 flex-col gap-1 pt-4 sm:w-56'
        >
          {sections.map((id) => {
            const { icon: Icon, label } = settingsSectionInfo[id];

            return (
              <button
                key={id}
                aria-current={section === id ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                  section === id &&
                    'bg-accent font-medium text-accent-foreground'
                )}
                onClick={() => setSection(id)}
                type='button'
              >
                <Icon aria-hidden='true' className='size-4' />
                {label}
              </button>
            );
          })}
        </nav>
        <main className='max-w-3xl min-w-0 flex-1 px-2 pt-4 sm:px-0'>
          <Panel />
        </main>
      </div>
    </div>
  );
}
