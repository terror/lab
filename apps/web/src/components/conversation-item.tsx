import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  conversationTitle,
  conversationsQueryKey,
  deleteConversation,
  updateConversation,
} from '@/lib/conversations';
import { cn } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  Archive,
  Ellipsis,
  LoaderCircle,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from 'lucide-react';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';

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

function MenuItems({
  Item,
  onArchive,
  onDelete,
  onPin,
  onRename,
  pinned,
}: {
  Item: typeof ContextMenuItem | typeof DropdownMenuItem;
  onArchive: () => void;
  onDelete: () => void;
  onPin: () => void;
  onRename: () => void;
  pinned: boolean;
}) {
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
      <Item onSelect={onArchive}>
        <Archive aria-hidden='true' />
        Archive
      </Item>
      <Item onSelect={onDelete} variant='destructive'>
        <Trash2 aria-hidden='true' />
        Delete
      </Item>
    </>
  );
}

export function ConversationItem({
  conversation,
  onSelect,
  selected,
}: {
  conversation: {
    id: number;
    pinned: boolean;
    running: boolean;
    title: string | null;
  };
  onSelect: (id: number) => void;
  selected: boolean;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const renaming = useRef(false);

  const title = conversationTitle(conversation.title);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: conversationsQueryKey });

  const update = useMutation({
    mutationFn: (change: Parameters<typeof updateConversation>[1]) =>
      updateConversation(conversation.id, change),
    onSettled: refresh,
  });

  const menuProps = {
    onArchive: () => update.mutate({ archived: true }),
    onPin: () => update.mutate({ pinned: !conversation.pinned }),
    pinned: conversation.pinned,
  };

  const remove = useMutation({
    mutationFn: () => deleteConversation(conversation.id),
    onSuccess: async () => {
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

  const confirmDelete = () => setConfirming(true);

  const onCloseAutoFocus = (event: Event) => {
    if (renaming.current) {
      renaming.current = false;
      event.preventDefault();
    }
  };

  if (editing) {
    return (
      <RenameInput
        initial={title}
        onCancel={() => setEditing(false)}
        onSubmit={(value) => {
          setEditing(false);
          update.mutate({ title: value });
        }}
      />
    );
  }

  return (
    <>
      <ContextMenu onOpenChange={setMenu}>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              'group flex items-center rounded-lg hover:bg-sidebar-accent',
              (selected || menu) &&
                'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
            )}
          >
            <button
              aria-current={selected ? 'page' : undefined}
              className='min-w-0 flex-1 px-2 py-1.5 text-left text-sm'
              onClick={() => onSelect(conversation.id)}
              type='button'
            >
              <span className='block truncate'>{title}</span>
              {conversation.running && <span className='sr-only'>Running</span>}
            </button>
            <div className='relative mr-1 flex'>
              <DropdownMenu onOpenChange={setMenu}>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label={`Options for ${title}`}
                    className='peer rounded-md p-1 text-muted-foreground opacity-0 outline-none group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100 data-[state=open]:opacity-100'
                    type='button'
                  >
                    <Ellipsis aria-hidden='true' className='size-4' />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align='start'
                  onCloseAutoFocus={onCloseAutoFocus}
                >
                  <MenuItems
                    {...menuProps}
                    Item={DropdownMenuItem}
                    onDelete={confirmDelete}
                    onRename={startRename}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
              {conversation.running && (
                <LoaderCircle
                  aria-hidden='true'
                  className='pointer-events-none absolute inset-0 m-auto size-3.5 text-muted-foreground group-hover:opacity-0 peer-focus-visible:opacity-0 peer-data-[state=open]:opacity-0 motion-safe:animate-spin'
                />
              )}
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent onCloseAutoFocus={onCloseAutoFocus}>
          <MenuItems
            {...menuProps}
            Item={ContextMenuItem}
            onDelete={confirmDelete}
            onRename={startRename}
          />
        </ContextMenuContent>
      </ContextMenu>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent size='sm'>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete “{title}”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => remove.mutate()}
              variant='destructive'
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
