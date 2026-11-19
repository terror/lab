import { PinMenu } from '@/components/artifact-apps';
import { SandboxFrame } from '@/components/sandbox-frame';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Unavailable } from '@/components/unavailable';
import { artifactCalls, useArtifact } from '@/lib/artifacts';
import { useLibraryImages } from '@/lib/library';
import { Link, useParams } from '@tanstack/react-router';
import { MessageSquare } from 'lucide-react';
import { useMemo } from 'react';

export function ArtifactPage() {
  const { artifactId, conversationId } = useParams({
    from: '/chat/apps/$conversationId/$artifactId',
  });

  const artifact = useArtifact(conversationId, artifactId);

  const html = useLibraryImages(artifact.data?.content ?? '');

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

  const { title } = artifact.data;

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <header className='flex h-12 shrink-0 items-center gap-2 px-4'>
        <h1 className='truncate text-sm font-medium'>{title}</h1>
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
