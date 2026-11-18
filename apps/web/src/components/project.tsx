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
import { Unavailable } from '@/components/unavailable';
import { usePins } from '@/lib/artifacts';
import { useConversations } from '@/lib/conversations';
import { useProject } from '@/lib/projects';
import { useParams } from '@tanstack/react-router';
import { Folder } from 'lucide-react';
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

function ProjectChats({ id }: { id: number }) {
  const chats = useConversations({ project: id });

  if (chats.isError) {
    return <LoadError className='px-2' subject='chats' />;
  }

  if (chats.isSuccess && chats.data.length === 0) {
    return (
      <p className='px-2 py-6 text-sm text-muted-foreground'>
        No chats in this project yet.
      </p>
    );
  }

  return (
    <nav aria-label='Project chats' className='flex flex-col gap-1'>
      {chats.data?.map((chat) => (
        <ConversationItem key={chat.id} conversation={chat} selected={false} />
      ))}
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
      <h2 className='px-2 text-sm font-medium text-muted-foreground'>Apps</h2>
      <nav aria-label='Project apps' className='flex flex-col gap-1'>
        {apps.data?.map((app) => (
          <AppLink key={`${app.conversationId}/${app.artifactId}`} app={app} />
        ))}
      </nav>
    </section>
  );
}

export function Project() {
  const id = Number(useParams({ from: '/chat/projects/$projectId' }).projectId);

  const project = useProject(id);

  const [editing, setEditing] = useState<ProjectEditing>();

  if (project.isSuccess && !project.data) {
    return <Unavailable subject='project' />;
  }

  if (project.isError) {
    return <LoadError className='m-6' subject='this project' />;
  }

  if (!project.data) {
    return null;
  }

  const current = project.data;

  return (
    <div className='min-h-0 flex-1 overflow-y-auto'>
      <div className='mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-8'>
        <div className='flex items-center gap-3'>
          <Folder
            aria-hidden='true'
            className='size-6 shrink-0 text-muted-foreground'
          />
          <h1 className='truncate text-2xl font-semibold tracking-tight'>
            {current.name}
          </h1>
          <ProjectMenu
            className='size-8 hover:bg-muted'
            onRename={() => setEditing({ kind: 'rename', project: current })}
            project={current}
          />
        </div>
        <ProjectComposer id={id} name={current.name} />
        <ProjectInstructions project={current} />
        <ProjectApps id={id} />
        <section className='flex flex-col gap-2'>
          <h2 className='px-2 text-sm font-medium text-muted-foreground'>
            Chats
          </h2>
          <ProjectChats id={id} />
        </section>
      </div>
      <ProjectDialog editing={editing} onClose={() => setEditing(undefined)} />
    </div>
  );
}
