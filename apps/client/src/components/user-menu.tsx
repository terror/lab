import { useAuth } from '@/hooks/use-auth';
import { useSignOut } from '@/hooks/use-sign-out';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';
import { Check, ChevronUp, LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import type { ComponentProps } from 'react';

export function UserMenu() {
  const auth = useAuth();
  const { pending, signOut } = useSignOut();
  const { theme, setTheme } = useTheme();

  const user = auth.data!.user;

  return (
    <div>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          disabled={pending}
          className='flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring'
        >
          <span className='flex size-9 shrink-0 items-center justify-center rounded-full bg-[#dfdad1] text-sm font-medium text-[#514c43] dark:bg-[#3d3a34] dark:text-[#ddd5c8]'>
            {(user.name || user.email).slice(0, 2).toUpperCase()}
          </span>
          <span className='min-w-0 flex-1'>
            <span className='block truncate text-sm font-medium'>
              {user.name || 'Your account'}
            </span>
            <span className='block truncate text-xs text-muted-foreground'>
              {user.email}
            </span>
          </span>
          <ChevronUp className='size-3.5 text-muted-foreground' />
        </DropdownMenu.Trigger>
        <MenuContent side='top' align='start' className='w-60'>
          <DropdownMenu.Label className='px-3 py-2 text-xs text-muted-foreground'>
            Appearance
          </DropdownMenu.Label>
          {(
            [
              { value: 'light', label: 'Light', icon: Sun },
              { value: 'dark', label: 'Dark', icon: Moon },
              { value: 'system', label: 'System', icon: Monitor },
            ] as const
          ).map(({ value, label, icon: Icon }) => (
            <MenuItem key={value} onSelect={() => setTheme(value)}>
              <Icon />
              <span className='flex-1'>{label}</span>
              {theme === value && <Check />}
            </MenuItem>
          ))}
          <DropdownMenu.Separator className='my-1.5 h-px bg-border' />
          <MenuItem disabled={pending} onSelect={() => void signOut()}>
            <LogOut />
            Sign out
          </MenuItem>
        </MenuContent>
      </DropdownMenu.Root>
    </div>
  );
}

function MenuContent({
  className,
  ...props
}: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        sideOffset={6}
        className={cn(
          'z-50 min-w-48 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg outline-none select-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          className
        )}
        {...props}
      />
    </DropdownMenu.Portal>
  );
}

function MenuItem({
  className,
  ...props
}: ComponentProps<typeof DropdownMenu.Item>) {
  return (
    <DropdownMenu.Item
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none select-none focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4',
        className
      )}
      {...props}
    />
  );
}
