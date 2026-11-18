import { ConfirmDialog } from '@/components/confirm-dialog';
import { LoadError } from '@/components/load-error';
import { StartComposer } from '@/components/start-composer';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow, ListSkeleton } from '@/components/ui/list-row';
import { Page, PageHeader } from '@/components/ui/page';
import { Pills } from '@/components/ui/pills';
import { SectionHeading } from '@/components/ui/section-heading';
import { conversationsQueryKey } from '@/lib/conversations';
import {
  type ScheduledTask,
  deleteTask,
  runTask,
  schedulesQueryOptions,
  setTaskEnabled,
  useScheduleAction,
} from '@/lib/schedules';
import { untilRun } from '@/lib/time';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Clock, Ellipsis } from 'lucide-react';
import { useState } from 'react';

type Filter = 'active' | 'all' | 'paused';

const filters: Record<
  Filter,
  {
    empty: { description: string; title: string };
    keep: (task: ScheduledTask) => boolean;
    label: string;
  }
> = {
  active: {
    empty: {
      description: 'Describe one above and Lab will set it up.',
      title: 'No active tasks',
    },
    keep: (task) => task.enabled,
    label: 'Active',
  },
  paused: {
    empty: {
      description: 'A task you pause waits here until you resume it.',
      title: 'No paused tasks',
    },
    keep: (task) => !task.enabled,
    label: 'Paused',
  },
  all: {
    empty: {
      description: 'Describe one above and Lab will set it up.',
      title: 'No scheduled tasks yet',
    },
    keep: () => true,
    label: 'All',
  },
};

const filterOptions = (['active', 'paused', 'all'] as const).map((value) => ({
  label: filters[value].label,
  value,
}));

function schedule(task: ScheduledTask) {
  if (!task.enabled) {
    return `${task.description} · Paused`;
  }

  if (!task.nextRunAt) {
    return task.description;
  }

  return `${task.description} · Next run ${untilRun(task.nextRunAt)}`;
}

function TaskSummary({ task }: { task: ScheduledTask }) {
  return (
    <>
      <Clock
        aria-hidden='true'
        className='size-4 shrink-0 text-muted-foreground'
      />
      <span className='flex min-w-0 flex-col'>
        <span className='truncate font-medium'>{task.title}</span>
        <span className='truncate text-muted-foreground'>{schedule(task)}</span>
      </span>
    </>
  );
}

function TaskRow({ task }: { task: ScheduledTask }) {
  const navigate = useNavigate();

  const toggle = useScheduleAction(setTaskEnabled);
  const queryClient = useQueryClient();

  const run = useScheduleAction(runTask, async ({ task: ran }) => {
    await queryClient.invalidateQueries({ queryKey: conversationsQueryKey });

    if (ran.conversationId !== null) {
      await navigate({ params: { id: ran.conversationId }, to: '/c/$id' });
    }
  });
  const remove = useScheduleAction(deleteTask);

  const [confirming, setConfirming] = useState(false);

  const actions = (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`Actions for ${task.title}`}
            size='icon-sm'
            variant='quiet'
          >
            <Ellipsis aria-hidden='true' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end'>
          <DropdownMenuItem onSelect={() => run.mutate(task.id)}>
            Run now
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              toggle.mutate({ enabled: !task.enabled, id: task.id })
            }
          >
            {task.enabled ? 'Pause' : 'Resume'}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setConfirming(true)}
            variant='destructive'
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        action='Delete'
        description='This can’t be undone. To stop it for a while, pause it instead.'
        onConfirm={() => remove.mutate(task.id)}
        onOpenChange={setConfirming}
        open={confirming}
        title={`Delete ${task.title}?`}
      />
    </>
  );

  if (task.conversationId === null) {
    return (
      <ListRow actions={actions}>
        <TaskSummary task={task} />
      </ListRow>
    );
  }

  return (
    <ListRow actions={actions} asChild>
      <Link params={{ id: task.conversationId }} to='/c/$id'>
        <TaskSummary task={task} />
      </Link>
    </ListRow>
  );
}

function SchedulePrompt() {
  return (
    <StartComposer
      draft='scheduled'
      placeholder='Schedule a task...'
      prompt={(content) => `Schedule this task: ${content}`}
    />
  );
}

export function Scheduled() {
  const [filter, setFilter] = useState<Filter>('active');

  const schedules = useQuery(schedulesQueryOptions);

  const tasks = schedules.data?.tasks.filter(filters[filter].keep) ?? [];

  return (
    <div className='min-h-0 flex-1 overflow-y-auto'>
      <Page>
        <PageHeader
          description='Lab runs these on a schedule in the chat where you set them up.'
          title='Scheduled'
        />
        <SchedulePrompt />
        <section className='flex flex-col gap-2'>
          <SectionHeading
            actions={
              <Pills
                label='Filter'
                onValueChange={setFilter}
                options={filterOptions}
                value={filter}
              />
            }
          >
            Tasks
          </SectionHeading>
          {schedules.isPending && <ListSkeleton />}
          {schedules.isLoadingError && (
            <LoadError
              onRetry={() => schedules.refetch()}
              subject='scheduled tasks'
            />
          )}
          {schedules.isSuccess && tasks.length === 0 && (
            <EmptyState {...filters[filter].empty} />
          )}
          <ul className='flex flex-col gap-0.5'>
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        </section>
      </Page>
    </div>
  );
}
