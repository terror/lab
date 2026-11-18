import { Button } from '@/components/ui/button';
import { useLatestChats } from '@/lib/conversations';
import { rise } from '@/lib/motion';
import { type Project, useProjects } from '@/lib/projects';
import { type ScheduledTask, schedulesQueryOptions } from '@/lib/schedules';
import { untilRun } from '@/lib/time';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  AppWindow,
  CalendarClock,
  Clock,
  Folder,
  type LucideIcon,
  MapPinned,
  MessageSquare,
} from 'lucide-react';
import { m } from 'motion/react';

type Chat = {
  id: number;
  projectId: number | null;
  title: string | null;
  unread: boolean;
};

type Suggestion = {
  icon: LucideIcon;
  label: string;
  meta?: string;
  run: () => void;
};

const starters = [
  {
    icon: AppWindow,
    label: 'Make a tiny app',
    prompt: 'Make me a tiny app that ',
  },
  {
    icon: MapPinned,
    label: 'Plan a trip',
    prompt: 'Plan a three-day trip to ',
  },
  {
    icon: CalendarClock,
    label: 'Remind me every Monday',
    prompt: 'Every Monday at 9am, remind me to ',
  },
];

function latestChat(chats: Chat[]) {
  return chats.find(({ title, unread }) => !unread && title !== null);
}

function latestProject(chats: Chat[], projects: Project[]) {
  const recent = chats.find(({ projectId }) => projectId !== null);

  return projects.find(({ id }) => id === recent?.projectId) ?? projects[0];
}

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

function useSuggestions(onPrompt: (prompt: string) => void): Suggestion[] {
  const navigate = useNavigate();
  const chats = useLatestChats();
  const projects = useProjects();
  const tasks = useQuery(schedulesQueryOptions);

  if (chats.isPending || projects.isPending || tasks.isPending) {
    return [];
  }

  const all = chats.data ?? [];
  const chat = latestChat(all);
  const project = latestProject(all, projects.data?.projects ?? []);
  const task = nextTask(tasks.data?.tasks ?? []);

  const found = [
    chat && {
      icon: MessageSquare,
      label: chat.title ?? '',
      run: () => void navigate({ params: { id: chat.id }, to: '/c/$id' }),
    },
    project && {
      icon: Folder,
      label: project.name,
      run: () =>
        void navigate({
          params: { projectId: String(project.id) },
          to: '/projects/$projectId',
        }),
    },
    task && {
      icon: Clock,
      label: task.title,
      meta: untilRun(task.nextRunAt),
      run: () =>
        void (task.conversationId === null
          ? navigate({ to: '/scheduled' })
          : navigate({ params: { id: task.conversationId }, to: '/c/$id' })),
    },
  ].filter((suggestion) => suggestion !== undefined);

  if (found.length > 0) {
    return found;
  }

  return starters.map(({ icon, label, prompt }) => ({
    icon,
    label,
    run: () => onPrompt(prompt),
  }));
}

export function Suggestions({
  onPrompt,
}: {
  onPrompt: (prompt: string) => void;
}) {
  const suggestions = useSuggestions(onPrompt);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <ul
      aria-label='Suggestions'
      className='flex flex-wrap justify-center gap-1.5'
    >
      {suggestions.map(({ icon: Icon, label, meta, run }, index) => (
        <m.li key={label} {...rise(index)}>
          <Button className='rounded-full' onClick={run} variant='outline'>
            <Icon
              aria-hidden='true'
              className='text-muted-foreground'
              data-icon='inline-start'
            />
            <span className='max-w-48 truncate'>{label}</span>{' '}
            {meta && (
              <span className='font-normal text-muted-foreground'>{meta}</span>
            )}
          </Button>
        </m.li>
      ))}
    </ul>
  );
}
