import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { conversationsQueryOptions } from '@/lib/conversations';
import {
  type Visibility,
  sharingQueryOptions,
  updateSharing,
  usersQueryOptions,
} from '@/lib/sharing';
import { cn } from '@/lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, type LucideIcon, Users, UsersRound } from 'lucide-react';
import { useState } from 'react';

const options: {
  description: string;
  icon: LucideIcon;
  label: string;
  value: Visibility;
}[] = [
  {
    description: 'Only you can see this chat.',
    icon: Lock,
    label: 'Private',
    value: 'private',
  },
  {
    description: 'Only the people you choose.',
    icon: Users,
    label: 'Specific people',
    value: 'shared',
  },
  {
    description: 'Everyone in your family.',
    icon: UsersRound,
    label: 'Family',
    value: 'family',
  },
];

function ShareForm({
  conversation,
  initial,
  onDone,
  userId,
}: {
  conversation: number;
  initial: { members: string[]; visibility: Visibility };
  onDone: () => void;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const users = useQuery(usersQueryOptions);

  const [visibility, setVisibility] = useState(initial.visibility);
  const [members, setMembers] = useState(new Set(initial.members));

  const save = useMutation({
    mutationFn: () =>
      updateSharing(conversation, { members: [...members], visibility }),
    onSuccess: async () => {
      onDone();
      await queryClient.invalidateQueries(conversationsQueryOptions);
    },
  });

  const toggle = (id: string, checked: boolean) => {
    const next = new Set(members);

    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }

    setMembers(next);
  };

  const others = (users.data ?? []).filter(({ id }) => id !== userId);

  return (
    <>
      <fieldset className='flex flex-col gap-2'>
        <legend className='sr-only'>Who can access this chat</legend>
        {options.map(({ description, icon: Icon, label, value }) => (
          <label
            key={value}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-accent has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
              visibility === value && 'border-primary bg-accent'
            )}
          >
            <input
              checked={visibility === value}
              className='sr-only'
              name='visibility'
              onChange={() => setVisibility(value)}
              type='radio'
              value={value}
            />
            <Icon aria-hidden='true' className='size-4 shrink-0' />
            <span className='flex flex-col'>
              <span className='text-sm font-medium'>{label}</span>
              <span className='text-xs text-muted-foreground'>
                {description}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      {visibility === 'shared' && (
        <fieldset className='flex max-h-56 flex-col gap-1 overflow-y-auto'>
          <legend className='mb-2 text-sm font-medium'>People</legend>
          {others.length === 0 && (
            <p className='text-sm text-muted-foreground'>
              No one else has joined Lab yet.
            </p>
          )}
          {others.map(({ email, id, name }) => (
            <label
              key={id}
              className='flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-accent'
              htmlFor={`member-${id}`}
            >
              <Checkbox
                checked={members.has(id)}
                id={`member-${id}`}
                onCheckedChange={(checked) => toggle(id, checked === true)}
              />
              <span className='flex min-w-0 flex-col'>
                <span className='truncate text-sm'>{name}</span>
                <span className='truncate text-xs text-muted-foreground'>
                  {email}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {save.isError && (
        <p role='alert' className='text-sm text-destructive'>
          {save.error.message}
        </p>
      )}
      <DialogFooter>
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          Save
        </Button>
      </DialogFooter>
    </>
  );
}

export function ShareDialog({
  conversation,
  onOpenChange,
  open,
  title,
  userId,
}: {
  conversation: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
  userId: string;
}) {
  const sharing = useQuery({
    ...sharingQueryOptions(conversation),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share chat</DialogTitle>
          <DialogDescription>
            Choose who can see and add to “{title}”.
          </DialogDescription>
        </DialogHeader>
        {sharing.data ? (
          <ShareForm
            conversation={conversation}
            initial={sharing.data}
            onDone={() => onOpenChange(false)}
            userId={userId}
          />
        ) : (
          <p className='text-sm text-muted-foreground'>Loading…</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
