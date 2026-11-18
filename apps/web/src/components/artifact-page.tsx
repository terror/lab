import { PinMenu } from '@/components/artifact-apps';
import { SandboxFrame } from '@/components/sandbox-frame';
import { Unavailable } from '@/components/unavailable';
import { artifactCalls, useArtifact } from '@/lib/artifacts';
import { useLibraryImages } from '@/lib/library';
import { Link, useParams } from '@tanstack/react-router';
import { LayoutTemplate, MessageSquare } from 'lucide-react';
import { useMemo } from 'react';

const action =
  'flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground';

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

  if (artifact.isError) {
    return <Unavailable subject='app' />;
  }

  if (!artifact.data || html === undefined) {
    return null;
  }

  const { title } = artifact.data;

  return (
    <div className='flex min-h-0 flex-1 flex-col'>
      <header className='flex items-center gap-2 border-b px-4 py-2'>
        <LayoutTemplate
          aria-hidden='true'
          className='size-4 shrink-0 text-muted-foreground'
        />
        <h1 className='truncate text-sm font-medium'>{title}</h1>
        <div className='ml-auto flex items-center gap-1'>
          <Link
            aria-label='Open chat'
            className={action}
            params={{ id: conversationId }}
            to='/c/$id'
          >
            <MessageSquare aria-hidden='true' className='size-4' />
          </Link>
          <PinMenu
            artifactId={artifactId}
            className={action}
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
