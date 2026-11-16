import { Members } from '@/components/members';
import { type Theme, useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { accountQueryOptions } from '@/lib/members';
import { closeSettings } from '@/lib/route';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronDown,
  type LucideIcon,
  Palette,
  Users,
} from 'lucide-react';
import { useState } from 'react';

const themes: { label: string; value: Theme }[] = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' },
];

function Appearance() {
  const { setTheme, theme } = useTheme();

  const label = themes.find(({ value }) => value === theme)?.label ?? 'System';

  return (
    <section className='space-y-6'>
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
              onValueChange={(value) => setTheme(value as Theme)}
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
