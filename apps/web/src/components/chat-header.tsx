import {
  ChatMenuItems,
  RenameInput,
  dropdownParts,
  useChatActions,
  useRenaming,
} from '@/components/chat-actions';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { IconButton } from '@/components/ui/icon-button';
import {
  conversationTitle,
  useConversationSummary,
  usePinnedConversations,
} from '@/lib/conversations';
import { useProject } from '@/lib/projects';
import { cn } from '@/lib/utils';
import { Link } from '@tanstack/react-router';
import { ChevronRight, Ellipsis, Folder, Pin } from 'lucide-react';
import { useRef } from 'react';

function ProjectCrumb({ id }: { id: number }) {
  const project = useProject(id);

  if (!project.data) {
    return null;
  }

  return (
    <>
      <Link
        className='flex min-w-0 shrink items-center gap-1.5 rounded-control px-1.5 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground'
        params={{ projectId: String(id) }}
        to='/projects/$projectId'
      >
        <Folder aria-hidden='true' className='size-4 shrink-0' />
        <span className='truncate'>{project.data.name}</span>
      </Link>
      <ChevronRight
        aria-hidden='true'
        className='size-3.5 shrink-0 text-muted-foreground'
      />
    </>
  );
}

export function ChatHeader({ id }: { id: number }) {
  const summary = useConversationSummary(id);
  const pins = usePinnedConversations();
  const options = useRef<HTMLButtonElement>(null);
  const renaming = useRenaming(options);

  const projectId = summary.data?.projectId ?? null;

  const pinned = pins.data?.some((chat) => chat.id === id) ?? false;

  const actions = useChatActions({ id, pinned, projectId }, true);

  const title = conversationTitle(summary.data?.title);

  const pin = pinned ? 'Unpin' : 'Pin';

  return (
    <header className='hidden h-12 shrink-0 items-center gap-1 px-3 md:flex'>
      {projectId !== null && <ProjectCrumb id={projectId} />}
      {renaming.editing ? (
        <RenameInput
          className='h-8 max-w-md bg-muted py-1 font-medium text-foreground'
          initial={title}
          onCancel={renaming.stop}
          onSubmit={(value) => {
            renaming.stop();
            actions.rename(value);
          }}
        />
      ) : (
        <h1
          className={cn(
            'min-w-0 truncate px-1.5 text-sm font-medium',
            summary.data?.title === null && 'text-muted-foreground'
          )}
        >
          {summary.data && title}
        </h1>
      )}
      <IconButton
        aria-pressed={pinned}
        label={pin}
        onClick={actions.menu.onPin}
        size='icon-sm'
      >
        <Pin aria-hidden='true' className={cn(pinned && 'fill-current')} />
      </IconButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label='Chat options'
            ref={options}
            size='icon-sm'
            variant='quiet'
          >
            <Ellipsis aria-hidden='true' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align='start'
          onCloseAutoFocus={renaming.onCloseAutoFocus}
        >
          <ChatMenuItems
            {...actions.menu}
            onRename={renaming.start}
            parts={dropdownParts}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
