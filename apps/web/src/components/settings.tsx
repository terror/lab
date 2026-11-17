import { Archived } from '@/components/archived';
import { Memory } from '@/components/memory';
import { Personalization } from '@/components/personalization';
import { Providers } from '@/components/providers';
import { Skills } from '@/components/skills';
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
import { useLineNumbers } from '@/lib/preferences';
import {
  type SettingsSection,
  settingsSections,
  useSettingsSection,
} from '@/lib/settings';
import { type Theme, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router';
import {
  Archive,
  ArrowLeft,
  Brain,
  ChartColumn,
  ChevronDown,
  KeyRound,
  type LucideIcon,
  Palette,
  UserRound,
  WandSparkles,
} from 'lucide-react';
import type { ComponentType } from 'react';

const themes: { label: string; value: Theme }[] = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' },
];

function Appearance() {
  const [theme, setTheme] = useTheme();
  const [lineNumbers, setLineNumbers] = useLineNumbers();

  const label = themes.find(({ value }) => value === theme)?.label ?? 'System';

  return (
    <section className='space-y-8'>
      <div className='space-y-1'>
        <h1 className='text-2xl font-semibold tracking-tight'>Appearance</h1>
        <p className='text-sm text-muted-foreground'>
          Choose how Lab looks to you.
        </p>
      </div>
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
    </section>
  );
}

const sections: Record<
  SettingsSection,
  { icon: LucideIcon; label: string; panel: ComponentType }
> = {
  appearance: { icon: Palette, label: 'Appearance', panel: Appearance },
  archived: { icon: Archive, label: 'Archived', panel: Archived },
  memory: { icon: Brain, label: 'Memory', panel: Memory },
  personalization: {
    icon: UserRound,
    label: 'Personalization',
    panel: Personalization,
  },
  providers: { icon: KeyRound, label: 'Providers', panel: Providers },
  skills: { icon: WandSparkles, label: 'Skills', panel: Skills },
  usage: { icon: ChartColumn, label: 'Usage', panel: UsagePanel },
};

export function Settings() {
  const [section, setSection] = useSettingsSection();

  const Panel = sections[section].panel;
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
          {settingsSections.map((id) => {
            const { icon: Icon, label } = sections[id];

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
