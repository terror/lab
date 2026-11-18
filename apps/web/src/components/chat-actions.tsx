import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import {
  conversationsQueryKey,
  deleteConversation,
  updateConversation,
} from '@/lib/conversations';
import { projectsQueryOptions, useProjects } from '@/lib/projects';
import { useUndoTrash } from '@/lib/trash';
import { undoToast } from '@/lib/undo';
import { cn } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  Folder,
  FolderInput,
  FolderMinus,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from 'lucide-react';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export function RenameInput({
  className,
  initial,
  onCancel,
  onSubmit,
}: {
  className?: string;
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
      className={cn(
        'w-full rounded-lg bg-sidebar-accent px-2 py-1.5 text-sm text-sidebar-accent-foreground outline-none',
        className
      )}
      onBlur={commit}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={onKeyDown}
      ref={input}
      value={value}
    />
  );
}

export const dropdownParts = {
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
  Sub: DropdownMenuSub,
  SubContent: DropdownMenuSubContent,
  SubTrigger: DropdownMenuSubTrigger,
};

export const contextParts = {
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

export function ChatMenuItems({
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

export function useRenaming() {
  const [editing, setEditing] = useState(false);
  const renaming = useRef(false);

  return {
    editing,
    onCloseAutoFocus: (event: Event) => {
      if (renaming.current) {
        renaming.current = false;
        event.preventDefault();
        setEditing(true);
      }
    },
    start: () => {
      renaming.current = true;
    },
    stop: () => setEditing(false),
  };
}

export function useChatActions(
  chat: { id: number; pinned: boolean; projectId: number | null },
  selected: boolean
) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: conversationsQueryKey });

  const update = useMutation({
    mutationFn: (change: Parameters<typeof updateConversation>[1]) =>
      updateConversation(chat.id, change),
    onSettled: refresh,
  });

  const move = useMutation({
    mutationFn: (projectId: number | null) =>
      updateConversation(chat.id, { projectId }),
    onSettled: async () => {
      await refresh();
      await queryClient.invalidateQueries({
        queryKey: projectsQueryOptions.queryKey,
      });
    },
    onSuccess: (_, projectId) => {
      const previous = chat.projectId;

      const name = queryClient
        .getQueryData(projectsQueryOptions.queryKey)
        ?.projects.find((project) => project.id === projectId)?.name;

      toast(name ? `Moved to ${name}.` : 'Removed from project.', {
        action: { label: 'Undo', onClick: () => move.mutate(previous) },
      });
    },
  });

  const undo = useUndoTrash();

  const remove = useMutation({
    mutationFn: () => deleteConversation(chat.id),
    onSuccess: async () => {
      undoToast('Chat moved to Trash.', () =>
        undo({ id: chat.id, kind: 'conversation' }, async () => {
          if (selected) {
            await navigate({ params: { id: chat.id }, to: '/c/$id' });
          }
        })
      );

      if (selected) {
        await navigate({ to: '/' });
      }

      await refresh();
    },
  });

  return {
    menu: {
      onDelete: () => remove.mutate(),
      onMove: (projectId: number | null) => move.mutate(projectId),
      onPin: () => update.mutate({ pinned: !chat.pinned }),
      pinned: chat.pinned,
      projectId: chat.projectId,
    },
    rename: (title: string) => update.mutate({ title }),
  };
}
