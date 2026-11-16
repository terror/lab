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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  conversationsQueryOptions,
  deleteConversation,
  renameConversation,
} from '@/lib/conversations';
import { cn } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Ellipsis, Pencil, Trash2 } from 'lucide-react';
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

export function ConversationItem({
  conversation,
  onSelect,
  selected,
}: {
  conversation: { id: number; title: string | null };
  onSelect: (id: number) => void;
  selected: boolean;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const renaming = useRef(false);

  const title = conversation.title ?? 'New chat';

  const refresh = () =>
    queryClient.invalidateQueries(conversationsQueryOptions);

  const rename = useMutation({
    mutationFn: (value: string) => renameConversation(conversation.id, value),
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: () => deleteConversation(conversation.id),
    onSuccess: async () => {
      if (selected) {
        await navigate({ to: '/' });
      }

      await refresh();
    },
  });

  if (editing) {
    return (
      <RenameInput
        initial={title}
        onCancel={() => setEditing(false)}
        onSubmit={(value) => {
          setEditing(false);
          rename.mutate(value);
        }}
      />
    );
  }

  return (
    <div
      className={cn(
        'group flex items-center rounded-lg hover:bg-sidebar-accent',
        (selected || menu) &&
          'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
      )}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenu(true);
      }}
    >
      <button
        aria-current={selected ? 'page' : undefined}
        className='min-w-0 flex-1 px-2 py-1.5 text-left text-sm'
        onClick={() => onSelect(conversation.id)}
        type='button'
      >
        <span className='block truncate'>{title}</span>
      </button>
      <DropdownMenu open={menu} onOpenChange={setMenu}>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={`Options for ${title}`}
            className='mr-1 rounded-md p-1 text-muted-foreground opacity-0 outline-none group-hover:opacity-100 hover:text-foreground focus-visible:opacity-100 data-[state=open]:opacity-100'
            type='button'
          >
            <Ellipsis aria-hidden='true' className='size-4' />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align='start'
          onCloseAutoFocus={(event) => {
            if (renaming.current) {
              renaming.current = false;
              event.preventDefault();
            }
          }}
        >
          <DropdownMenuItem
            onSelect={() => {
              renaming.current = true;
              setEditing(true);
            }}
          >
            <Pencil aria-hidden='true' />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setConfirming(true)}
            variant='destructive'
          >
            <Trash2 aria-hidden='true' />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
    </div>
  );
}
