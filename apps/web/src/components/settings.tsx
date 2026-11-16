import { Button } from '@/components/ui/button';
import { closeSettings } from '@/lib/route';
import { type Theme, setTheme, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  type LucideIcon,
  Monitor,
  Moon,
  Palette,
  Sun,
} from 'lucide-react';

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

export function Settings() {
  return (
    <div className='flex min-h-svh flex-col'>
      <header className='px-4 py-3'>
        <Button onClick={closeSettings} variant='ghost'>
          <ArrowLeft aria-hidden='true' />
          Back to chat
        </Button>
      </header>
      <div className='mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-8 sm:flex-row sm:gap-12'>
        <nav
          aria-label='Settings'
          className='flex shrink-0 flex-col gap-1 sm:w-48'
        >
          <button
            aria-current='page'
            className='flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-left text-sm font-medium text-accent-foreground'
            type='button'
          >
            <Palette aria-hidden='true' className='size-4' />
            Appearance
          </button>
        </nav>
        <main className='min-w-0 flex-1'>
          <Appearance />
        </main>
      </div>
    </div>
  );
}
