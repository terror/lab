import { MotionSidebarRow, useRowPresence } from '@/components/sidebar-row';
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
import { usePeeking } from '@/components/ui/peek';
import {
  type PinnedApp,
  useArtifactActivity,
  usePin,
  usePinUpdate,
} from '@/lib/artifacts';
import { useHint } from '@/lib/hints';
import { usePath } from '@/lib/location';
import { useMediaQuery } from '@/lib/media';
import { useProjects } from '@/lib/projects';
import { Link } from '@tanstack/react-router';
import { Pin, PinOff } from 'lucide-react';
import { useEffect, useState } from 'react';

export function AppLink({
  app,
  onSelect,
}: {
  app: PinnedApp;
  onSelect?: () => void;
}) {
  const path = usePath();
  const presence = useRowPresence();

  const active = path === `/apps/${app.conversationId}/${app.artifactId}`;

  return (
    <MotionSidebarRow {...presence} asChild selected={active}>
      <Link
        aria-current={active ? 'page' : undefined}
        onClick={onSelect}
        params={{
          artifactId: app.artifactId,
          conversationId: app.conversationId,
        }}
        to='/apps/$conversationId/$artifactId'
      >
        <span className='truncate'>{app.title}</span>
      </Link>
    </MotionSidebarRow>
  );
}

const SAVED_MS = 1500;

const FIRST_SAVED_MS = 5000;

const SAVED_COOLDOWN_MS = 10_000;

function useSaved(writes: number, asking: boolean) {
  const [seen, setSeen] = useState(writes);
  const [burst, setBurst] = useState<number>();
  const [cooling, setCooling] = useState<number>();
  const wide = useMediaQuery('(min-width: 640px)');

  if (writes !== seen) {
    setSeen(writes);

    if (burst === undefined && cooling !== undefined) {
      setCooling(writes);
    } else {
      setBurst(writes);
    }
  }

  const saved = burst !== undefined;

  const { pending, retire, show } = useHint(
    'first-save',
    saved && !asking && wide
  );

  useEffect(() => {
    if (burst === undefined) {
      return undefined;
    }

    const timer = setTimeout(
      () => {
        setBurst(undefined);
        setCooling(burst);

        if (show) {
          retire();
        }
      },
      show ? FIRST_SAVED_MS : SAVED_MS
    );

    return () => clearTimeout(timer);
  }, [burst, retire, show]);

  useEffect(() => {
    if (cooling === undefined) {
      return undefined;
    }

    const timer = setTimeout(() => setCooling(undefined), SAVED_COOLDOWN_MS);

    return () => clearTimeout(timer);
  }, [cooling]);

  return { first: saved && show, saved: saved && !pending };
}

function statusText({
  asking,
  first,
  saved,
}: {
  asking: boolean;
  first: boolean;
  saved: boolean;
}) {
  if (asking) {
    return 'Asking Lab';
  }

  if (!saved) {
    return undefined;
  }

  return first ? 'Saved. It’ll be here next time.' : 'Saved';
}

export function useAppStatus(
  conversationId: number | undefined,
  artifactId: string
) {
  const activity = useArtifactActivity(conversationId, artifactId);
  const asking = usePeeking(activity.asking > 0);
  const { first, saved } = useSaved(activity.saved, asking);

  return { asking, status: statusText({ asking, first, saved }) };
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
