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
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>What’s new</DialogTitle>
          <DialogDescription>
            Lab was updated since you last used it.
          </DialogDescription>
        </DialogHeader>
        <ul className='-mx-2 flex max-h-80 flex-col overflow-y-auto'>
          {entries.map(({ date, sha, title, url }) => (
            <li key={sha}>
              <a
                className='flex items-baseline justify-between gap-4 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50'
                href={url}
                rel='noreferrer'
                target='_blank'
              >
                <span className='min-w-0'>{title}</span>
                {date && (
                  <span className='shrink-0 text-xs text-muted-foreground tabular-nums'>
                    {day.format(new Date(date))}
                  </span>
                )}
              </a>
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
