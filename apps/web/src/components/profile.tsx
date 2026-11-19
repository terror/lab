import { UserAvatar } from '@/components/account-menu';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ErrorMessage } from '@/components/error-message';
import { LoadError } from '@/components/load-error';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/ui/page';
import { SectionHeading } from '@/components/ui/section-heading';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { signOut, useUser } from '@/lib/auth';
import {
  memoryQueryOptions,
  updateMemory,
  useMemoryUpdate,
} from '@/lib/memory';
import {
  deleteAccount,
  exportUrl,
  removePicture,
  setPicture,
  useAdmin,
  usePictureUpdate,
} from '@/lib/profile';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, ImagePlus, LoaderCircle, Trash2 } from 'lucide-react';
import { type SubmitEvent, useRef, useState } from 'react';

function Instructions({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);

  const save = useMemoryUpdate((instructions: string) =>
    updateMemory({ instructions })
  );

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    save.mutate(value);
  };

  return (
    <form className='flex flex-col gap-3' onSubmit={onSubmit}>
      <Textarea
        aria-label='Custom instructions'
        id='instructions'
        maxLength={4_000}
        onChange={(event) => setValue(event.target.value)}
        placeholder='I’m a software engineer. Keep answers short and show code first.'
        rows={5}
        value={value}
      />
      <div className='flex justify-end'>
        <Button
          disabled={value === initial || save.isPending}
          size='sm'
          type='submit'
        >
          Save
        </Button>
      </div>
    </form>
  );
}

function Picture() {
  const user = useUser();

  const upload = usePictureUpdate(setPicture);
  const remove = usePictureUpdate(removePicture);

  const [confirming, setConfirming] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const error = upload.error ?? remove.error;
  const pending = upload.isPending || remove.isPending;

  return (
    <section className='flex flex-col gap-3'>
      <SectionHeading>Picture</SectionHeading>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-busy={pending}
            aria-label='Edit profile picture'
            className='size-16 rounded-full border-0 p-0'
            disabled={pending}
            size='icon'
            variant='ghost'
          >
            <span aria-hidden='true'>
              <UserAvatar
                className='size-16 text-lg transition-opacity group-hover/button:opacity-80'
                user={user}
              />
              <span className='absolute right-0 bottom-0 flex size-6 items-center justify-center rounded-full bg-background text-muted-foreground shadow-xs ring-2 ring-background group-hover/button:text-foreground'>
                {pending ? (
                  <LoaderCircle className='animate-spin' />
                ) : (
                  <Camera />
                )}
              </span>
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => input.current?.click()}>
            <ImagePlus aria-hidden='true' />
            {user.image ? 'Change picture' : 'Upload picture'}
          </DropdownMenuItem>
          {user.image && (
            <DropdownMenuItem
              onSelect={() => setConfirming(true)}
              variant='destructive'
            >
              <Trash2 aria-hidden='true' />
              Remove picture
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={input}
        accept='image/png,image/jpeg,image/gif,image/webp'
        aria-label='Upload picture'
        className='hidden'
        disabled={pending}
        onChange={(event) => {
          const [file] = event.target.files ?? [];

          if (file) {
            upload.mutate(file);
          }

          event.target.value = '';
        }}
        type='file'
      />
      {error && <ErrorMessage>{error.message}</ErrorMessage>}
      <ConfirmDialog
        action='Remove'
        description='Lab will delete your picture and show your initials instead. This can’t be undone.'
        onConfirm={() => remove.mutate(undefined)}
        onOpenChange={setConfirming}
        open={confirming}
        title='Remove your picture?'
      />
    </section>
  );
}

export function YourData() {
  const admin = useAdmin();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const remove = useMutation({
    meta: { inlineError: true },
    mutationFn: deleteAccount,
    onSuccess: () => signOut(queryClient),
  });

  return (
    <section className='flex flex-col gap-3'>
      <SectionHeading>Your data</SectionHeading>
      <p className='text-sm text-muted-foreground'>
        {admin
          ? 'Download your chats, settings, and memories.'
          : 'Download your chats, settings, and memories, or delete your account and everything in it.'}
      </p>
      <div className='flex gap-2'>
        <Button asChild size='sm' variant='outline'>
          <a download href={exportUrl}>
            Export data
          </a>
        </Button>
        {!admin && (
          <Button
            disabled={remove.isPending}
            onClick={() => setConfirming(true)}
            size='sm'
            variant='ghost'
          >
            Delete account
          </Button>
        )}
      </div>
      {remove.error && <ErrorMessage>{remove.error.message}</ErrorMessage>}
      <ConfirmDialog
        action='Delete account'
        description='Your chats, projects, files, memories, connectors, and computer will be permanently deleted. This can’t be undone.'
        onConfirm={() => remove.mutate()}
        onOpenChange={setConfirming}
        open={confirming}
        title='Delete your account?'
      />
    </section>
  );
}

export function Profile() {
  const memory = useQuery(memoryQueryOptions);

  return (
    <>
      <PageHeader
        description='Your picture and instructions.'
        title='Profile'
      />
      <Picture />
      <section className='flex flex-col gap-3'>
        <SectionHeading>Custom instructions</SectionHeading>
        <p className='text-sm text-muted-foreground'>
          What Lab should know about you and how it should respond.
        </p>
        {memory.isPending && <Skeleton className='h-30 w-full rounded-md' />}
        {memory.isLoadingError && (
          <LoadError
            onRetry={() => memory.refetch()}
            subject='your instructions'
          />
        )}
        {memory.data && (
          <Instructions
            key={memory.data.instructions}
            initial={memory.data.instructions}
          />
        )}
      </section>
      <YourData />
    </>
  );
}
