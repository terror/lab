import { ShelfTile } from '@/components/ui/shelf-tile';
import { useLatestPin } from '@/lib/artifacts';
import { useCapabilities } from '@/lib/capabilities';
import { useLatestChats } from '@/lib/conversations';
import { useProjects } from '@/lib/projects';
import { type ScheduledTask, schedulesQueryOptions } from '@/lib/schedules';
import { untilRun } from '@/lib/time';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  AppWindow,
  Clock,
  Folder,
  type LucideIcon,
  MessageSquare,
} from 'lucide-react';

type Line = { icon: LucideIcon; key: string; label: string; prompt: string };

function nextTask(tasks: ScheduledTask[]) {
  return tasks
    .flatMap((task) =>
      task.enabled && task.nextRunAt !== null
        ? [{ ...task, nextRunAt: task.nextRunAt }]
        : []
    )
    .toSorted((a, b) => a.nextRunAt.localeCompare(b.nextRunAt))
    .at(0);
}

export function useShelf() {
  const chats = useLatestChats();
  const projects = useProjects();
  const tasks = useQuery(schedulesQueryOptions);
  const pin = useLatestPin();
  const capabilities = useCapabilities();

  const all = chats.data ?? [];

  const recent = all.find(({ projectId }) => projectId !== null);

  const listed = projects.data?.projects ?? [];

  const project =
    listed.find(({ id }) => id === recent?.projectId) ?? listed[0];

  const lines = (capabilities ?? []).flatMap(
    ({ icon, id, label, prompt, tried }) =>
      prompt === undefined ? [] : [{ icon, key: id, label, prompt, tried }]
  );

  const tries: (Line | undefined)[] = [
    project && {
      icon: Folder,
      key: 'project',
      label: `Catch up on ${project.name}`,
      prompt: `Catch me up on where ${project.name} stands.`,
    },
    pin.data && {
      icon: AppWindow,
      key: 'app',
      label: `Improve ${pin.data.title}`,
      prompt: `Suggest three improvements for my ${pin.data.title} app.`,
    },
    lines.find(({ tried }) => !tried),
  ];

  return {
    chat: all.find(({ title, unread }) => !unread && title !== null),
    fresh: chats.data?.length === 0,
    loading: chats.isPending,
    pin: pin.data,
    project,
    ready: !(
      chats.isPending ||
      projects.isPending ||
      tasks.isPending ||
      pin.isPending
    ),
    starters: capabilities && lines.slice(0, 3),
    task: nextTask(tasks.data?.tasks ?? []),
    tries: tries.filter((line) => line !== undefined),
  };
}

type Shelf = ReturnType<typeof useShelf>;

export function Prompts({
  label,
  lines,
  onPreview,
  onPrompt,
}: {
  label: string;
  lines: Line[];
  onPreview: (prompt: string | undefined) => void;
  onPrompt: (prompt: string) => void;
}) {
  if (lines.length === 0) {
    return null;
  }

  return (
    <ul aria-label={label} className='-mx-3 flex flex-wrap gap-1'>
      {lines.map(({ icon: Icon, key, label: title, prompt }) => (
        <li key={key} className='max-w-full min-w-0'>
          <ShelfTile
            className='min-h-11 w-auto max-w-full'
            glyph={<Icon aria-hidden='true' />}
            onBlur={() => onPreview(undefined)}
            onClick={() => onPrompt(prompt)}
            onFocus={() => onPreview(prompt)}
            onPointerEnter={() => onPreview(prompt)}
            onPointerLeave={() => onPreview(undefined)}
            title={title}
          />
        </li>
      ))}
    </ul>
  );
}

function taskLink(task: NonNullable<Shelf['task']>, tile: React.ReactNode) {
  if (task.conversationId === null) {
    return <Link to='/scheduled'>{tile}</Link>;
  }

  return (
    <Link params={{ id: task.conversationId }} to='/c/$id'>
      {tile}
    </Link>
  );
}

export function PickUp({
  chat,
  pin,
  project,
  task,
}: Pick<Shelf, 'chat' | 'pin' | 'project' | 'task'>) {
  if (!chat && !pin && !project && !task) {
    return null;
  }

  return (
    <ul
      aria-label='Pick up'
      className='-mx-3 grid grid-cols-1 gap-1 @lg:grid-cols-2'
    >
      {chat && (
        <li className='min-w-0'>
          <ShelfTile
            glyph={<MessageSquare aria-hidden='true' />}
            renderLink={(tile) => (
              <Link params={{ id: chat.id }} to='/c/$id'>
                {tile}
              </Link>
            )}
            meta='Last chat'
            title={chat.title}
          />
        </li>
      )}
      {pin && (
        <li className='min-w-0'>
          <ShelfTile
            glyph={<AppWindow aria-hidden='true' />}
            renderLink={(tile) => (
              <Link
                params={{
                  artifactId: pin.artifactId,
                  conversationId: pin.conversationId,
                }}
                to='/apps/$conversationId/$artifactId'
              >
                {tile}
              </Link>
            )}
            meta='Pinned app'
            title={pin.title}
          />
        </li>
      )}
      {project && (
        <li className='min-w-0'>
          <ShelfTile
            glyph={<Folder aria-hidden='true' />}
            renderLink={(tile) => (
              <Link
                params={{ projectId: String(project.id) }}
                to='/projects/$projectId'
              >
                {tile}
              </Link>
            )}
            meta='Project'
            title={project.name}
          />
        </li>
      )}
      {task && (
        <li className='min-w-0'>
          <ShelfTile
            glyph={<Clock aria-hidden='true' />}
            renderLink={(tile) => taskLink(task, tile)}
            meta={`Runs ${untilRun(task.nextRunAt)}`}
            title={task.title}
          />
        </li>
      )}
    </ul>
  );
}
