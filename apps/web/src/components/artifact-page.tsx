import {
  PinMenu,
  useAppStatus,
  useSeenVersion,
} from '@/components/artifact-apps';
import { SandboxFrame } from '@/components/sandbox-frame';
import { Button, buttonVariants } from '@/components/ui/button';
import { RollingNumber } from '@/components/ui/rolling-number';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusNote } from '@/components/ui/status-note';
import { Unavailable } from '@/components/unavailable';
import { artifactCalls, useArtifact } from '@/lib/artifacts';
import { useLibraryImages } from '@/lib/library';
import { Link, useParams } from '@tanstack/react-router';
import { MessageSquare } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

function Version({ from, version }: { from: number; version: number }) {
  const [shown, setShown] = useState(from);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(version));

    return () => cancelAnimationFrame(frame);
  }, [version]);

  if (version < 2) {
    return undefined;
  }

  return (
    <span className='text-xs text-muted-foreground'>
      v<RollingNumber value={shown} />
    </span>
  );
}

function AppPage({
  artifactId,
  conversationId,
}: {
  artifactId: string;
  conversationId: number;
}) {
  const artifact = useArtifact(conversationId, artifactId);

  const html = useLibraryImages(artifact.data?.content ?? '');

  const { status } = useAppStatus(conversationId, artifactId);
  const from = useSeenVersion(conversationId, artifactId);

  const onCall = useMemo(
    () => artifactCalls(conversationId, artifactId),
    [artifactId, conversationId]
  );

  if (artifact.data === null || artifact.isLoadingError) {
    return <Unavailable subject='app' />;
  }

  if (!artifact.data || html === undefined) {
    return (
      <div aria-busy='true' className='flex min-h-0 flex-1 flex-col'>
        <div className='flex h-12 items-center px-4'>
          <Skeleton className='w-40' />
        </div>
        <div className='flex-1 p-4'>
          <Skeleton className='size-full rounded-card' />
        </div>
      </div>
    );
  }

  const { title, version } = artifact.data;

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <header className='flex h-12 shrink-0 items-center gap-2 px-4'>
        <h1 className='truncate text-sm font-medium'>{title}</h1>
        {from !== undefined && (
          <Version
            from={Math.min(from ?? version, version)}
            version={version}
          />
        )}
        <StatusNote>{status}</StatusNote>
        <div className='ml-auto flex items-center gap-1'>
          <Button asChild size='icon' variant='quiet'>
            <Link
              aria-label='Open chat'
              params={{ id: conversationId }}
              to='/c/$id'
            >
              <MessageSquare aria-hidden='true' />
            </Link>
          </Button>
          <PinMenu
            artifactId={artifactId}
            className={buttonVariants({ size: 'icon', variant: 'quiet' })}
            conversationId={conversationId}
          />
        </div>
      </header>
      <div className='min-h-0 flex-1 overflow-y-auto p-4'>
        <SandboxFrame html={html} onCall={onCall} title={title} />
      </div>
    </div>
  );
}

export function ArtifactPage() {
  const { artifactId, conversationId } = useParams({
    from: '/chat/apps/$conversationId/$artifactId',
  });

  return (
    <AppPage
      key={`${conversationId}:${artifactId}`}
      artifactId={artifactId}
      conversationId={conversationId}
    />
  );
}
