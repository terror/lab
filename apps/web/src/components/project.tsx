import { AppLink } from '@/components/artifact-apps';
import { ConversationItem } from '@/components/conversation-item';
import { LoadError } from '@/components/load-error';
import { LoadMore } from '@/components/load-more';
import {
  type ProjectEditing,
  ProjectDialog,
} from '@/components/project-dialog';
import { ProjectInstructions } from '@/components/project-instructions';
import { ProjectMenu } from '@/components/project-menu';
import { StartComposer } from '@/components/start-composer';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/list-row';
import { Page, PageHeader } from '@/components/ui/page';
import { SectionHeading } from '@/components/ui/section-heading';
import { Skeleton } from '@/components/ui/skeleton';
import { Unavailable } from '@/components/unavailable';
import { usePins } from '@/lib/artifacts';
import { useConversations } from '@/lib/conversations';
import { useNote } from '@/lib/hints';
import { useProject } from '@/lib/projects';
import { useEmpty } from '@/lib/voice';
import { useParams } from '@tanstack/react-router';
import { useState } from 'react';

function ProjectComposer({ id, name }: { id: number; name: string }) {
  return (
    <StartComposer
      draft={`project:${id}`}
      placeholder={`New chat in ${name}`}
      projectId={id}
    />
  );
}

function ProjectChats({ id, instructed }: { id: number; instructed: boolean }) {
  const chats = useConversations({ project: id });

  useNote('project', !instructed && (chats.data?.length ?? 0) >= 3);

  const emptyState = useEmpty('project');

  if (chats.isPending) {
    return <ListSkeleton />;
  }

  if (chats.isLoadingError) {
    return <LoadError onRetry={() => chats.refetch()} subject='chats' />;
  }

  if (chats.data?.length === 0) {
    return <EmptyState {...emptyState} />;
  }

  return (
    <nav aria-label='Project chats' className='-mx-2'>
      <ul className='flex flex-col gap-1'>
        {chats.data?.map((chat) => (
          <ConversationItem
            key={chat.id}
            conversation={chat}
            selected={false}
          />
        ))}
      </ul>
      {chats.hasNextPage && !chats.isFetchingNextPage && (
        <LoadMore onLoadMore={() => void chats.fetchNextPage()} />
      )}
    </nav>
  );
}

function ProjectApps({ id }: { id: number }) {
  const apps = usePins(id);

  if ((apps.data?.length ?? 0) === 0) {
    return null;
  }

  return (
    <section className='flex flex-col gap-2'>
      <SectionHeading>Apps</SectionHeading>
      <nav aria-label='Project apps' className='-mx-2'>
        <ul className='flex flex-col gap-1'>
          {apps.data?.map((app) => (
            <AppLink
              key={`${app.conversationId}/${app.artifactId}`}
              app={app}
            />
          ))}
        </ul>
      </nav>
    </section>
  );
}

function ProjectSkeleton() {
  return (
    <div aria-busy='true' className='flex flex-col gap-8'>
      <Skeleton className='h-8 w-1/3' />
      <Skeleton className='h-24 rounded-card' />
      <ListSkeleton />
    </div>
  );
}

export function Project() {
  const id = Number(useParams({ from: '/chat/projects/$projectId' }).projectId);

  const project = useProject(id);

  const [editing, setEditing] = useState<ProjectEditing>();

  if (project.isSuccess && !project.data) {
    return <Unavailable subject='project' />;
  }

  const current = project.data;

  return (
    <div className='min-h-0 flex-1 overflow-y-auto'>
      <Page>
        {project.isPending && <ProjectSkeleton />}
        {project.isLoadingError && (
          <LoadError onRetry={() => project.refetch()} subject='this project' />
        )}
        {current && (
          <>
            <PageHeader
              actions={
                <ProjectMenu
                  className={buttonVariants({ size: 'icon', variant: 'quiet' })}
                  onRename={() =>
                    setEditing({ kind: 'rename', project: current })
                  }
                  project={current}
                />
              }
              title={current.name}
            />
            <ProjectComposer id={id} name={current.name} />
            <ProjectInstructions project={current} />
            <ProjectApps id={id} />
            <section className='flex flex-col gap-2'>
              <SectionHeading>Chats</SectionHeading>
              <ProjectChats
                id={id}
                instructed={current.instructions.trim() !== ''}
              />
            </section>
          </>
        )}
      </Page>
      <ProjectDialog editing={editing} onClose={() => setEditing(undefined)} />
    </div>
  );
}
