import { Members } from '@/components/members';
import { Button } from '@/components/ui/button';
import { accountQueryOptions } from '@/lib/members';
import { closeSettings } from '@/lib/route';
import { type Theme, setTheme, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  type LucideIcon,
  Monitor,
  Moon,
  Palette,
  Sun,
  Users,
} from 'lucide-react';
import { useState } from 'react';

const themes: {
  description: string;
  icon: LucideIcon;
  label: string;
  value: Theme;
}[] = [
  {
    description: 'Always use the light theme.',
    icon: Sun,
    label: 'Light',
    value: 'light',
  },
  {
    description: 'Always use the dark theme.',
    icon: Moon,
    label: 'Dark',
    value: 'dark',
  },
  {
    description: 'Match your device settings.',
    icon: Monitor,
    label: 'System',
    value: 'system',
  },
];

function Appearance() {
  const current = useTheme();

  return (
    <section className='space-y-6'>
      <div className='space-y-1'>
        <h1 className='text-2xl font-semibold tracking-tight'>Appearance</h1>
        <p className='text-sm text-muted-foreground'>
          Choose how Lab looks to you.
        </p>
      </div>
      <fieldset className='space-y-3'>
        <legend className='mb-3 text-sm font-medium'>Theme</legend>
        <div className='grid gap-3 sm:grid-cols-3'>
          {themes.map(({ description, icon: Icon, label, value }) => (
            <label
              key={value}
              className={cn(
                'flex cursor-pointer flex-col gap-3 rounded-xl border p-4 transition-colors hover:bg-accent has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
                current === value && 'border-primary bg-accent'
              )}
            >
              <input
                checked={current === value}
                className='sr-only'
                name='theme'
                onChange={() => setTheme(value)}
                type='radio'
                value={value}
              />
              <Icon aria-hidden='true' className='size-5' />
              <span className='space-y-0.5'>
                <span className='block text-sm font-medium'>{label}</span>
                <span className='block text-xs text-muted-foreground'>
                  {description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
}

type Tab = 'appearance' | 'members';

const tabs: { admin: boolean; icon: LucideIcon; label: string; value: Tab }[] =
  [
    { admin: false, icon: Palette, label: 'Appearance', value: 'appearance' },
    { admin: true, icon: Users, label: 'Members', value: 'members' },
  ];

function TabContent({ tab, userId }: { tab: Tab; userId: string }) {
  if (tab === 'members') {
    return <Members userId={userId} />;
  }

  return <Appearance />;
}

export function Settings({ userId }: { userId: string }) {
  const account = useQuery(accountQueryOptions);
  const [tab, setTab] = useState<Tab>('appearance');

  const visible = tabs.filter(
    ({ admin }) => !admin || account.data?.admin === true
  );

  return (
    <div className='flex min-h-svh flex-col'>
      <header className='px-4 py-3'>
        <Button onClick={closeSettings} variant='ghost'>
          <ArrowLeft aria-hidden='true' />
          Back to chat
        </Button>
      </header>
      <div className='flex w-full flex-1 flex-col gap-8 px-4 pb-8 sm:flex-row sm:gap-12'>
        <nav
          aria-label='Settings'
          className='flex shrink-0 flex-col gap-1 pt-4 sm:w-56'
        >
          {visible.map(({ icon: Icon, label, value }) => (
            <button
              key={value}
              aria-current={tab === value ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent',
                tab === value && 'bg-accent font-medium text-accent-foreground'
              )}
              onClick={() => setTab(value)}
              type='button'
            >
              <Icon aria-hidden='true' className='size-4' />
              {label}
            </button>
          ))}
        </nav>
        <main className='max-w-3xl min-w-0 flex-1 px-2 pt-4 sm:px-0'>
          <TabContent tab={tab} userId={userId} />
        </main>
      </div>
    </div>
  );
}
