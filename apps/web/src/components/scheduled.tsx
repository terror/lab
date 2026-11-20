import { ConfirmDialog } from '@/components/confirm-dialog';
import { LoadError } from '@/components/load-error';
import { StartComposer } from '@/components/start-composer';
import { Button } from '@/components/ui/button';
import { Dot } from '@/components/ui/dot';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow, ListSkeleton } from '@/components/ui/list-row';
import { LiveMark } from '@/components/ui/live-mark';
import { Page, PageHeader } from '@/components/ui/page';
import { Pills } from '@/components/ui/pills';
import { SectionHeading } from '@/components/ui/section-heading';
import { TaskClock } from '@/components/ui/task-clock';
import { conversationsQueryKey, useUnreadChats } from '@/lib/conversations';
import {
  type ScheduledTask,
  deleteTask,
  runTask,
  schedulesQueryOptions,
  setTaskEnabled,
  useScheduleAction,
} from '@/lib/schedules';
import { untilRun } from '@/lib/time';
import { type EmptyView, useEmpty, useQuiet } from '@/lib/voice';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Ellipsis } from 'lucide-react';
import { useState } from 'react';

type Filter = 'active' | 'all' | 'paused';

const filters: Record<
  Filter,
  {
    empty: EmptyView;
    keep: (task: ScheduledTask) => boolean;
    label: string;
  }
> = {
  active: {
    empty: 'active',
    keep: (task) => task.enabled,
    label: 'Active',
  },
  paused: {
    empty: 'paused',
    keep: (task) => !task.enabled,
    label: 'Paused',
  },
  all: {
    empty: 'tasks',
    keep: () => true,
    label: 'All',
  },
};

const filterOptions = (['active', 'paused', 'all'] as const).map((value) => ({
  label: filters[value].label,
  value,
}));

function schedule(task: ScheduledTask, now: number) {
  if (!task.enabled) {
    return `${task.description} · Paused`;
  }

  if (!task.nextRunAt) {
    return task.description;
  }

  return `${task.description} · Next run ${untilRun(task.nextRunAt, now)}`;
}

function progress({ lastRunAt, nextRunAt }: ScheduledTask, now: number) {
  if (!lastRunAt || !nextRunAt) {
    return undefined;
  }

  const last = Date.parse(lastRunAt);

  return (now - last) / (Date.parse(nextRunAt) - last);
}

function TaskSummary({
  now,
  task,
  turns,
  unread,
}: {
  now: number;
  task: ScheduledTask;
  turns: number;
  unread: boolean;
}) {
  return (
    <>
      {task.running ? (
        <LiveMark className='size-4' state='thinking' />
      ) : (
        <TaskClock
          paused={!task.enabled}
          progress={progress(task, Math.floor(now / 60_000) * 60_000)}
          since={task.lastRunAt ?? undefined}
          turns={turns}
        />
      )}
      <span className='flex min-w-0 flex-col'>
        <span className='truncate font-medium'>{task.title}</span>
        <span className='truncate text-muted-foreground'>
          {schedule(task, now)}
        </span>
      </span>
      {task.running && <span className='sr-only'>Running</span>}
      {unread && <span className='sr-only'>Unread</span>}
    </>
  );
}

function TaskRow({ now, task }: { now: number; task: ScheduledTask }) {
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

  const quiet = useQuiet();

  const [wound, setWound] = useState({ enabled: task.enabled, turns: 0 });

  if (wound.enabled !== task.enabled) {
    setWound({
      enabled: task.enabled,
      turns: task.enabled && !quiet ? wound.turns + 1 : wound.turns,
    });
  }

  const unreadChats = useUnreadChats();

  const unread =
    !task.running &&
    (unreadChats.data?.chats ?? []).some(
      ({ id }) => id === task.conversationId
    );

  const summary = (
    <TaskSummary now={now} task={task} turns={wound.turns} unread={unread} />
  );

  const status = unread && <Dot tone='attention' />;

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
      <ListRow actions={actions} status={status}>
        {summary}
      </ListRow>
    );
  }

  return (
    <ListRow actions={actions} asChild status={status}>
      <Link params={{ id: task.conversationId }} to='/c/$id'>
        {summary}
      </Link>
    </ListRow>
  );
}

function SchedulePrompt() {
  return (
    <StartComposer
      draft='scheduled'
      placeholder='Schedule a task…'
      prompt={(content) => `Schedule this task: ${content}`}
    />
  );
}

export function Scheduled() {
  const [filter, setFilter] = useState<Filter>('active');

  const busy = (useUnreadChats().data?.running ?? 0) > 0;

  const schedules = useQuery({
    ...schedulesQueryOptions,
    refetchInterval: ({ state }) =>
      busy || state.data?.tasks.some(({ running }) => running) ? 2_000 : 60_000,
  });

  const tasks = schedules.data?.tasks.filter(filters[filter].keep) ?? [];

  const emptyState = useEmpty(filters[filter].empty);

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
            <EmptyState {...emptyState} />
          )}
          <ul className='flex flex-col gap-0.5'>
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                now={schedules.dataUpdatedAt}
                task={task}
              />
            ))}
          </ul>
        </section>
      </Page>
    </div>
  );
}
