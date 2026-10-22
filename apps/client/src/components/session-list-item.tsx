import { RenameSession } from '@/components/rename-session';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useDeleteSession } from '@/hooks/use-sessions';
import { cn } from '@/lib/utils';
import type { SessionMetadata } from '@lab/shared';
import { LoaderCircle, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

export function SessionListItem({
  session,
  selected,
  onSelect,
  onDeleted,
}: {
  session: SessionMetadata;
  selected: boolean;
  onSelect: (sessionId: string) => void;
  onDeleted: (sessionId: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const deletion = useDeleteSession(onDeleted);

  return (
    <ContextMenu>
      <ContextMenuTrigger
        asChild
        disabled={session.role !== 'manager' || renaming || deletion.isPending}
      >
        <li
          className={cn(
            'relative flex items-center rounded-lg transition-colors hover:bg-sidebar-accent',
            (selected || renaming) && 'bg-sidebar-accent'
          )}
        >
          {renaming ? (
            <RenameSession
              session={session}
              onClose={() => setRenaming(false)}
            />
          ) : (
            <button
              type='button'
              aria-current={selected ? 'page' : undefined}
              aria-busy={deletion.isPending}
              disabled={deletion.isPending}
              onClick={() => onSelect(session.sessionId)}
              className='min-w-0 flex-1 rounded-lg px-2.5 py-2.5 text-left text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50'
            >
              <span
                className={cn('block truncate', deletion.isPending && 'pr-5')}
              >
                {session.title || 'New chat'}
              </span>
            </button>
          )}
          {deletion.isPending && (
            <LoaderCircle
              aria-label='Deleting chat'
              className='absolute right-2.5 size-3.5 text-muted-foreground motion-safe:animate-spin'
            />
          )}
        </li>
      </ContextMenuTrigger>
      <ContextMenuContent
        onCloseAutoFocus={(event) => {
          if (renaming) {
            event.preventDefault();
          }
        }}
      >
        <ContextMenuItem onSelect={() => setRenaming(true)}>
          <Pencil />
          Rename
        </ContextMenuItem>
        <ContextMenuItem
          variant='destructive'
          onSelect={() => deletion.mutate(session.sessionId)}
        >
          <Trash2 />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
