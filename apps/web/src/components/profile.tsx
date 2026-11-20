import { UserAvatar } from '@/components/account-menu';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ErrorMessage } from '@/components/error-message';
import { LoadError } from '@/components/load-error';
import { SettingRow } from '@/components/setting-row';
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
import { StatusNote } from '@/components/ui/status-note';
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
import { type SubmitEvent, useId, useRef, useState } from 'react';

function useInstructionsUpdate() {
  return useMemoryUpdate((instructions: string) =>
    updateMemory({ instructions })
  );
}

function Instructions({
  initial,
  save,
}: {
  initial: string;
  save: ReturnType<typeof useInstructionsUpdate>;
}) {
  const [value, setValue] = useState(initial);
  const description = useId();

  const dirty = value !== initial;

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    save.mutate(value);
  };

  return (
    <form className='flex flex-col gap-2.5' onSubmit={onSubmit}>
      <div className='flex min-h-10 items-center gap-3'>
        <div className='flex min-w-0 flex-1 flex-col gap-0.5 text-sm'>
          <label className='font-medium' htmlFor='instructions'>
            Custom instructions
          </label>
          <span className='text-muted-foreground' id={description}>
            What Lab should know about you and how it should respond.
          </span>
        </div>
        <div className='flex shrink-0 items-center gap-2.5'>
          <StatusNote>
            {save.isSuccess && !dirty ? 'Saved' : undefined}
          </StatusNote>
          {dirty && (
            <Button disabled={save.isPending} size='sm' type='submit'>
              Save
            </Button>
          )}
        </div>
      </div>
      <Textarea
        aria-describedby={description}
        className='max-h-80 min-h-24 resize-none'
        id='instructions'
        maxLength={4_000}
        onChange={(event) => setValue(event.target.value)}
        placeholder='I’m a software engineer. Keep answers short and show code first.'
        value={value}
      />
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

  const control = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-busy={pending}
          aria-label='Edit profile picture'
          className='size-10 rounded-full border-0 p-0'
          disabled={pending}
          size='icon'
          variant='ghost'
        >
          <span aria-hidden='true'>
            <UserAvatar
              className='size-10 transition-opacity group-hover/button:opacity-80'
              user={user}
            />
            <span className='absolute -right-0.5 -bottom-0.5 flex size-4.5 items-center justify-center rounded-full bg-background text-muted-foreground shadow-xs ring-2 ring-background group-hover/button:text-foreground'>
              {pending ? (
                <LoaderCircle className='size-3 animate-spin' />
              ) : (
                <Camera className='size-3' />
              )}
            </span>
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
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
  );

  return (
    <div className='flex flex-col gap-2'>
      <ul className='flex flex-col gap-0.5'>
        <SettingRow
          control={control}
          description='PNG, JPEG, GIF, or WebP.'
          label='Picture'
        />
      </ul>
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
    </div>
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
    <section className='flex flex-col gap-2'>
      <SectionHeading>Your data</SectionHeading>
      <ul className='flex flex-col gap-0.5'>
        <SettingRow
          control={
            <Button asChild size='sm' variant='outline'>
              <a download href={exportUrl}>
                Export data
              </a>
            </Button>
          }
          description='Your chats, settings, and memories.'
          label='Download a copy'
        />
        {!admin && (
          <SettingRow
            control={
              <Button
                disabled={remove.isPending}
                onClick={() => setConfirming(true)}
                size='sm'
                variant='destructive'
              >
                Delete account
              </Button>
            }
            description='Permanently delete your chats, projects, files, memories, connectors, and computer.'
            label='Delete account'
          />
        )}
      </ul>
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
  const save = useInstructionsUpdate();

  return (
    <>
      <PageHeader
        description='Your picture, instructions, and data.'
        title='Profile'
      />
      <div className='flex flex-col gap-5'>
        <Picture />
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
            save={save}
          />
        )}
      </div>
      <YourData />
    </>
  );
}
