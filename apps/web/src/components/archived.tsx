import { Button } from '@/components/ui/button';
import {
  conversationTitle,
  conversationsQueryKey,
  deleteConversation,
  updateConversation,
  useArchivedConversations,
} from '@/lib/conversations';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

function ArchivedChat({ id, title }: { id: number; title: string | null }) {
  const queryClient = useQueryClient();

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: conversationsQueryKey });

  const unarchive = useMutation({
    mutationFn: () => updateConversation(id, { archived: false }),
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: () => deleteConversation(id),
    onSettled: refresh,
  });

  const name = conversationTitle(title);

  return (
    <li className='flex items-center gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-muted/50'>
      <Link
        className='min-w-0 flex-1 truncate text-sm'
        params={{ id }}
        to='/c/$id'
      >
        {name}
      </Link>
      <div className='flex shrink-0 items-center gap-1'>
        <Button
          aria-label={`Delete ${name}`}
          disabled={remove.isPending}
          onClick={() => remove.mutate()}
          size='sm'
          variant='ghost'
        >
          Delete
        </Button>
        <Button
          aria-label={`Unarchive ${name}`}
          disabled={unarchive.isPending}
          onClick={() => unarchive.mutate()}
          size='sm'
          variant='secondary'
        >
          Unarchive
        </Button>
      </div>
    </li>
  );
}

export function Archived() {
  const archived = useArchivedConversations();

  return (
    <section className='space-y-8'>
      <div className='space-y-1'>
        <h1 className='text-2xl font-semibold tracking-tight'>Archived</h1>
        <p className='text-sm text-muted-foreground'>
          Archived chats are hidden from the sidebar until you unarchive them.
        </p>
      </div>
      {archived.isError && (
        <p role='alert' className='text-sm text-destructive'>
          Unable to load archived chats.
        </p>
      )}
      {archived.isSuccess && archived.data.length === 0 && (
        <p className='text-sm text-muted-foreground'>No archived chats.</p>
      )}
      <ul className='-mx-3 flex flex-col'>
        {archived.data?.map(({ id, title }) => (
          <ArchivedChat key={id} id={id} title={title} />
        ))}
      </ul>
    </section>
  );
}
