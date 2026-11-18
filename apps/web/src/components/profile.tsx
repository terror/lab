import { UserAvatar } from '@/components/account-menu';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ErrorMessage } from '@/components/error-message';
import { LoadError } from '@/components/load-error';
import { SettingsPage } from '@/components/settings-page';
import { Button } from '@/components/ui/button';
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
import { type SubmitEvent, useState } from 'react';

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
      <div className='space-y-1'>
        <label className='text-sm font-medium' htmlFor='instructions'>
          Custom instructions
        </label>
        <p className='text-sm text-muted-foreground'>
          What Lab should know about you and how it should respond.
        </p>
      </div>
      <Textarea
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

  const error = upload.error ?? remove.error;

  return (
    <section className='flex flex-col gap-3'>
      <div className='space-y-1'>
        <h2 className='text-sm font-medium'>Profile picture</h2>
        <p className='text-sm text-muted-foreground'>
          Shown in the sidebar next to your name.
        </p>
      </div>
      <div className='flex items-center gap-4'>
        <UserAvatar className='size-16 text-lg' user={user} />
        <div className='flex gap-2'>
          <Button asChild size='sm' variant='outline'>
            <label>
              {user.image ? 'Change picture' : 'Upload picture'}
              <input
                accept='image/png,image/jpeg,image/gif,image/webp'
                className='sr-only'
                disabled={upload.isPending}
                onChange={(event) => {
                  const [file] = event.target.files ?? [];

                  if (file) {
                    upload.mutate(file);
                  }

                  event.target.value = '';
                }}
                type='file'
              />
            </label>
          </Button>
          {user.image && (
            <Button
              disabled={remove.isPending}
              onClick={() => remove.mutate(undefined)}
              size='sm'
              variant='ghost'
            >
              Remove
            </Button>
          )}
        </div>
      </div>
      {error && <ErrorMessage>{error.message}</ErrorMessage>}
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
      <div className='space-y-1'>
        <h2 className='text-sm font-medium'>Your data</h2>
        <p className='text-sm text-muted-foreground'>
          {admin
            ? 'Download your chats, settings, and memories.'
            : 'Download your chats, settings, and memories, or delete your account and everything in it.'}
        </p>
      </div>
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
    <SettingsPage
      description='Your picture and how Lab should respond in every chat.'
      title='Profile'
    >
      <Picture />
      {memory.isError && <LoadError subject='your profile' />}
      {memory.data && (
        <Instructions
          key={memory.data.instructions}
          initial={memory.data.instructions}
        />
      )}
      <YourData />
    </SettingsPage>
  );
}
