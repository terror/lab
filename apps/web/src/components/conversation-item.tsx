import { SidebarRow, rowAction } from '@/components/sidebar-row';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Dot } from '@/components/ui/dot';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LiveMark } from '@/components/ui/live-mark';
import {
  conversationTitle,
  conversationsQueryKey,
  deleteConversation,
  updateConversation,
} from '@/lib/conversations';
import { projectsQueryOptions, useProjects } from '@/lib/projects';
import { useUndoTrash } from '@/lib/trash';
import { undoToast } from '@/lib/undo';
import { cn } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  Ellipsis,
  Folder,
  FolderInput,
  FolderMinus,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from 'lucide-react';
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';

function RenameInput({
  initial,
  onCancel,
  onSubmit,
}: {
  initial: string;
  onCancel: () => void;
  onSubmit: (title: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  const commit = () => {
    const title = value.trim();

    if (title && title !== initial) {
      onSubmit(title);
    } else {
      onCancel();
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    }

    if (event.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <input
      aria-label='Chat title'
      className='w-full rounded-lg bg-sidebar-accent px-2 py-1.5 text-sm text-sidebar-accent-foreground outline-none'
      onBlur={commit}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={onKeyDown}
      ref={input}
      value={value}
    />
  );
}

const dropdownParts = {
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
  Sub: DropdownMenuSub,
  SubContent: DropdownMenuSubContent,
  SubTrigger: DropdownMenuSubTrigger,
};

const contextParts = {
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
  Sub: ContextMenuSub,
  SubContent: ContextMenuSubContent,
  SubTrigger: ContextMenuSubTrigger,
};

type MenuParts = typeof dropdownParts | typeof contextParts;

function MoveItems({
  onMove,
  parts: { Item, Separator, Sub, SubContent, SubTrigger },
  projectId,
}: {
  onMove: (projectId: number | null) => void;
  parts: MenuParts;
  projectId: number | null;
}) {
  const projects = useProjects();

  const targets =
    projects.data?.projects.filter((project) => project.id !== projectId) ?? [];

  if (targets.length === 0 && projectId === null) {
    return null;
  }

  return (
    <Sub>
      <SubTrigger>
        <FolderInput aria-hidden='true' />
        Move to project
      </SubTrigger>
      <SubContent className='max-h-80 overflow-y-auto'>
        {targets.map((project) => (
          <Item key={project.id} onSelect={() => onMove(project.id)}>
            <Folder aria-hidden='true' />
            <span className='truncate'>{project.name}</span>
          </Item>
        ))}
        {projectId !== null && (
          <>
            {targets.length > 0 && <Separator />}
            <Item onSelect={() => onMove(null)}>
              <FolderMinus aria-hidden='true' />
              Remove from project
            </Item>
          </>
        )}
      </SubContent>
    </Sub>
  );
}

function MenuItems({
  onDelete,
  onMove,
  onPin,
  onRename,
  parts,
  pinned,
  projectId,
}: {
  onDelete: () => void;
  onMove: (projectId: number | null) => void;
  onPin: () => void;
  onRename: () => void;
  parts: MenuParts;
  pinned: boolean;
  projectId: number | null;
}) {
  const { Item } = parts;

  return (
    <>
      <Item onSelect={onPin}>
        {pinned ? <PinOff aria-hidden='true' /> : <Pin aria-hidden='true' />}
        {pinned ? 'Unpin' : 'Pin'}
      </Item>
      <Item onSelect={onRename}>
        <Pencil aria-hidden='true' />
        Rename
      </Item>
      <MoveItems onMove={onMove} parts={parts} projectId={projectId} />
      <Item onSelect={onDelete} variant='destructive'>
        <Trash2 aria-hidden='true' />
        Delete
      </Item>
    </>
  );
}

type Activity = 'idle' | 'running' | 'unread' | 'waiting';

const indicators: Record<
  Activity,
  { attention: boolean; label: string; mark: ReactNode } | undefined
> = {
  idle: undefined,
  running: {
    attention: false,
    label: 'Running',
    mark: <LiveMark className='size-3.5' state='thinking' />,
  },
  unread: { attention: true, label: 'Unread', mark: <Dot tone='attention' /> },
  waiting: {
    attention: true,
    label: 'Needs you',
    mark: <Dot tone='attention' />,
  },
};

function activity(
  {
    running,
    unread,
    waiting,
  }: { running: boolean; unread: boolean; waiting: boolean },
  selected: boolean
): Activity {
  if (waiting) {
    return 'waiting';
  }

  if (running) {
    return 'running';
  }

  return unread && !selected ? 'unread' : 'idle';
}

export function ConversationItem({
  conversation,
  onSelect,
  selected,
}: {
  conversation: {
    id: number;
    pinned: boolean;
    projectId: number | null;
    running: boolean;
    title: string | null;
    unread: boolean;
    waiting: boolean;
  };
  onSelect?: () => void;
  selected: boolean;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const renaming = useRef(false);

  const title = conversationTitle(conversation.title);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: conversationsQueryKey });

  const update = useMutation({
    mutationFn: (change: Parameters<typeof updateConversation>[1]) =>
      updateConversation(conversation.id, change),
    onSettled: refresh,
  });

  const move = useMutation({
    mutationFn: (projectId: number | null) =>
      updateConversation(conversation.id, { projectId }),
    onSettled: async () => {
      await refresh();
      await queryClient.invalidateQueries({
        queryKey: projectsQueryOptions.queryKey,
      });
    },
    onSuccess: (_, projectId) => {
      const previous = conversation.projectId;

      const name = queryClient
        .getQueryData(projectsQueryOptions.queryKey)
        ?.projects.find((project) => project.id === projectId)?.name;

      toast(name ? `Moved to ${name}.` : 'Removed from project.', {
        action: { label: 'Undo', onClick: () => move.mutate(previous) },
      });
    },
  });

  const menuProps = {
    onMove: (projectId: number | null) => move.mutate(projectId),
    onPin: () => update.mutate({ pinned: !conversation.pinned }),
    pinned: conversation.pinned,
    projectId: conversation.projectId,
  };

  const undo = useUndoTrash();

  const remove = useMutation({
    mutationFn: () => deleteConversation(conversation.id),
    onSuccess: async () => {
      undoToast('Chat moved to Trash.', () =>
        undo({ id: conversation.id, kind: 'conversation' }, async () => {
          if (selected) {
            await navigate({ params: { id: conversation.id }, to: '/c/$id' });
          }
        })
      );

      if (selected) {
        await navigate({ to: '/' });
      }

      await refresh();
    },
  });

  const startRename = () => {
    renaming.current = true;
    setEditing(true);
  };

  const onCloseAutoFocus = (event: Event) => {
    if (renaming.current) {
      renaming.current = false;
      event.preventDefault();
    }
  };

  if (editing) {
    return (
      <li>
        <RenameInput
          initial={title}
          onCancel={() => setEditing(false)}
          onSubmit={(value) => {
            setEditing(false);
            update.mutate({ title: value });
          }}
        />
      </li>
    );
  }

  const indicator = indicators[activity(conversation, selected)];

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <SidebarRow
          actions={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label={`Options for ${title}`}
                  className={rowAction}
                  type='button'
                >
                  <Ellipsis aria-hidden='true' />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align='start'
                onCloseAutoFocus={onCloseAutoFocus}
              >
                <MenuItems
                  {...menuProps}
                  parts={dropdownParts}
                  onDelete={() => remove.mutate()}
                  onRename={startRename}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          }
          asChild
          className={cn(indicator?.attention && 'font-medium')}
          selected={selected}
          status={indicator?.mark}
        >
          <Link
            aria-current={selected ? 'page' : undefined}
            onClick={onSelect}
            params={{ id: conversation.id }}
            to='/c/$id'
          >
            <span className='truncate'>{title}</span>
            {indicator && <span className='sr-only'>{indicator.label}</span>}
          </Link>
        </SidebarRow>
      </ContextMenuTrigger>
      <ContextMenuContent onCloseAutoFocus={onCloseAutoFocus}>
        <MenuItems
          {...menuProps}
          parts={contextParts}
          onDelete={() => remove.mutate()}
          onRename={startRename}
        />
      </ContextMenuContent>
    </ContextMenu>
  );
}
