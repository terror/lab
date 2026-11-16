import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  type ChangelogEntry,
  changelogQueryOptions,
  latestVersionQueryOptions,
  loadedVersionQueryOptions,
  useSeenVersion,
} from '@/lib/version';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { toast } from 'sonner';

const DEVELOPMENT = 'development';

const day = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
});

export function Changelog({
  entries,
  onClose,
}: {
  entries: ChangelogEntry[];
  onClose: () => void;
}) {
  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open
    >
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>What’s new</DialogTitle>
          <DialogDescription>
            Lab was updated since you last used it.
          </DialogDescription>
        </DialogHeader>
        <ul className='flex max-h-96 flex-col gap-5 overflow-y-auto'>
          {entries.map(({ date, description, sha, title, url }) => (
            <li key={sha} className='flex flex-col gap-1'>
              <div className='flex items-baseline justify-between gap-4'>
                <a
                  className='text-sm font-medium hover:underline'
                  href={url}
                  rel='noreferrer'
                  target='_blank'
                >
                  {title}
                </a>
                {date && (
                  <span className='shrink-0 text-xs text-muted-foreground tabular-nums'>
                    {day.format(new Date(date))}
                  </span>
                )}
              </div>
              {description && (
                <p className='text-sm leading-relaxed text-muted-foreground'>
                  {description}
                </p>
              )}
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PendingChangelog({
  onDone,
  since,
}: {
  onDone: () => void;
  since: string;
}) {
  const changelog = useQuery(changelogQueryOptions(since));

  const entries = changelog.data?.entries ?? [];

  useEffect(() => {
    if (changelog.isError || (changelog.isSuccess && entries.length === 0)) {
      onDone();
    }
  }, [changelog.isError, changelog.isSuccess, entries.length, onDone]);

  if (entries.length === 0) {
    return null;
  }

  return <Changelog entries={entries} onClose={onDone} />;
}

export function Updates() {
  const loaded = useQuery(loadedVersionQueryOptions).data?.version;
  const current = useQuery(latestVersionQueryOptions).data?.version;
  const [seen, setSeen] = useSeenVersion();

  useEffect(() => {
    if (!current || !loaded || current === loaded || current === DEVELOPMENT) {
      return;
    }

    toast('A new version of Lab is available.', {
      action: { label: 'Refresh', onClick: () => window.location.reload() },
      duration: Infinity,
      id: 'update',
    });
  }, [current, loaded]);

  useEffect(() => {
    if (loaded && loaded !== DEVELOPMENT && !seen) {
      setSeen(loaded);
    }
  }, [loaded, seen, setSeen]);

  if (!loaded || loaded === DEVELOPMENT || !seen || seen === loaded) {
    return null;
  }

  return <PendingChangelog onDone={() => setSeen(loaded)} since={seen} />;
}
