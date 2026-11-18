import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { type PinnedApp, usePin, usePinUpdate } from '@/lib/artifacts';
import { useProjects } from '@/lib/projects';
import { Link } from '@tanstack/react-router';
import { LayoutTemplate, Pin, PinOff } from 'lucide-react';

export function AppLink({
  app,
  onSelect,
}: {
  app: PinnedApp;
  onSelect?: () => void;
}) {
  return (
    <Link
      activeProps={{
        className:
          'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
      }}
      className='flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm focus-ring-inset hover:bg-sidebar-accent'
      onClick={onSelect}
      params={{
        artifactId: app.artifactId,
        conversationId: app.conversationId,
      }}
      to='/apps/$conversationId/$artifactId'
    >
      <LayoutTemplate
        aria-hidden='true'
        className='size-4 shrink-0 text-muted-foreground'
      />
      <span className='truncate'>{app.title}</span>
    </Link>
  );
}

function placement(pin: PinnedApp | undefined) {
  if (!pin) {
    return '';
  }

  return pin.projectId === null ? 'sidebar' : String(pin.projectId);
}

export function PinMenu({
  artifactId,
  className,
  conversationId,
}: {
  artifactId: string;
  className: string;
  conversationId: number;
}) {
  const pin = usePin(conversationId, artifactId);
  const projects = useProjects();
  const update = usePinUpdate(conversationId, artifactId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={pin.data ? 'Pinned' : 'Pin'}
          className={className}
          type='button'
        >
          <Pin aria-hidden='true' className='size-4' />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='max-h-80 overflow-y-auto'>
        <DropdownMenuLabel>Pin to</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          onValueChange={(value) =>
            update.pin.mutate(value === 'sidebar' ? null : Number(value))
          }
          value={placement(pin.data)}
        >
          <DropdownMenuRadioItem value='sidebar'>Sidebar</DropdownMenuRadioItem>
          {projects.data?.projects.map((project) => (
            <DropdownMenuRadioItem key={project.id} value={String(project.id)}>
              <span className='truncate'>{project.name}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {pin.data && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => update.unpin.mutate()}>
              <PinOff aria-hidden='true' />
              Unpin
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
