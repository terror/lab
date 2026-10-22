import { Button } from '@/components/ui/button';
import { PanelLeft } from 'lucide-react';
import type { ReactNode } from 'react';

export function ChatHeader({
  title,
  onMobileMenu,
  onOpenSidebar,
  sidebarCollapsed,
  children,
}: {
  title: string;
  onMobileMenu: () => void;
  onOpenSidebar: () => void;
  sidebarCollapsed: boolean;
  children?: ReactNode;
}) {
  return (
    <header className='flex h-16 shrink-0 items-center gap-3 px-4 select-none sm:px-6'>
      <Button
        variant='ghost'
        size='icon'
        className='md:hidden'
        onClick={onMobileMenu}
        aria-label='Open sidebar'
      >
        <PanelLeft />
      </Button>
      {sidebarCollapsed && (
        <Button
          variant='ghost'
          size='icon'
          className='hidden md:inline-flex'
          onClick={onOpenSidebar}
          aria-label='Expand sidebar'
          title='Expand sidebar'
        >
          <PanelLeft />
        </Button>
      )}
      <div className='min-w-0 flex-1'>
        <p className='truncate text-sm font-medium'>{title}</p>
      </div>
      {children}
    </header>
  );
}
