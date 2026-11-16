import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  inviteMember,
  membersQueryOptions,
  removeMember,
  revokeInvitation,
} from '@/lib/members';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type SubmitEvent, useState } from 'react';

type Member = { admin: boolean; email: string; id: string; name: string };

function RemoveMember({
  member,
  onRemove,
}: {
  member: Member;
  onRemove: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size='sm' variant='ghost'>
          Remove
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent size='sm'>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {member.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            They will be signed out, and the chats they own will be deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onRemove} variant='destructive'>
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function InviteForm({ onInvited }: { onInvited: () => Promise<void> }) {
  const [email, setEmail] = useState('');

  const invite = useMutation({
    mutationFn: () => inviteMember(email.trim()),
    onSuccess: async () => {
      setEmail('');
      await onInvited();
    },
  });

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (email.trim()) {
      invite.mutate();
    }
  };

  return (
    <form className='flex flex-col gap-2' onSubmit={onSubmit}>
      <div className='flex gap-2'>
        <input
          aria-label='Email address'
          className='h-9 min-w-0 flex-1 rounded-lg border bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground'
          onChange={(event) => setEmail(event.target.value)}
          placeholder='name@example.com'
          required
          type='email'
          value={email}
        />
        <Button disabled={invite.isPending} type='submit'>
          Invite
        </Button>
      </div>
      {invite.isError && (
        <p role='alert' className='text-sm text-destructive'>
          {invite.error.message}
        </p>
      )}
    </form>
  );
}

export function Members({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const members = useQuery(membersQueryOptions);

  const refresh = () => queryClient.invalidateQueries(membersQueryOptions);

  const remove = useMutation({ mutationFn: removeMember, onSuccess: refresh });
  const revoke = useMutation({
    mutationFn: revokeInvitation,
    onSuccess: refresh,
  });

  return (
    <section className='space-y-8'>
      <div className='space-y-1'>
        <h1 className='text-2xl font-semibold tracking-tight'>Members</h1>
        <p className='text-sm text-muted-foreground'>
          Invite family members to Lab by the email they sign in with.
        </p>
      </div>
      <InviteForm onInvited={refresh} />
      <div className='space-y-3'>
        <h2 className='text-sm font-medium'>People</h2>
        <ul className='divide-y rounded-xl border'>
          {members.data?.members.map((member) => (
            <li key={member.id} className='flex items-center gap-3 px-4 py-3'>
              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-medium'>
                  {member.name}
                  {member.admin && (
                    <span className='ml-2 text-xs font-normal text-muted-foreground'>
                      Admin
                    </span>
                  )}
                </p>
                <p className='truncate text-xs text-muted-foreground'>
                  {member.email}
                </p>
              </div>
              {member.id !== userId && !member.admin && (
                <RemoveMember
                  member={member}
                  onRemove={() => remove.mutate(member.id)}
                />
              )}
            </li>
          ))}
        </ul>
      </div>
      {(members.data?.invitations.length ?? 0) > 0 && (
        <div className='space-y-3'>
          <h2 className='text-sm font-medium'>Invited</h2>
          <ul className='divide-y rounded-xl border'>
            {members.data?.invitations.map(({ email }) => (
              <li key={email} className='flex items-center gap-3 px-4 py-3'>
                <p className='min-w-0 flex-1 truncate text-sm'>{email}</p>
                <Button
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(email)}
                  size='sm'
                  variant='ghost'
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {(remove.error ?? revoke.error) && (
        <p role='alert' className='text-sm text-destructive'>
          {(remove.error ?? revoke.error)?.message}
        </p>
      )}
    </section>
  );
}
