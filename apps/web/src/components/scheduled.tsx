import { Composer } from '@/components/composer';
import { LoadError } from '@/components/load-error';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Attachment } from '@/lib/attachments';
import {
  conversationsQueryKey,
  createConversation,
  useDraft,
} from '@/lib/conversations';
import { useChatModel } from '@/lib/models';
import {
  type ScheduledTask,
  deleteTask,
  runTask,
  schedulesQueryOptions,
  setTaskEnabled,
  untilRun,
  useScheduleAction,
} from '@/lib/schedules';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ChevronDown, Clock, Ellipsis } from 'lucide-react';
import { useState } from 'react';

type Filter = 'active' | 'all' | 'paused';

const filters: Record<
  Filter,
  { empty: string; keep: (task: ScheduledTask) => boolean; label: string }
> = {
  active: {
    empty: 'No active tasks. Describe one above and Lab will set it up.',
    keep: (task) => task.enabled,
    label: 'Active',
  },
  paused: {
    empty: 'No paused tasks.',
    keep: (task) => !task.enabled,
    label: 'Paused',
  },
  all: {
    empty: 'No scheduled tasks yet. Describe one above and Lab will set it up.',
    keep: () => true,
    label: 'All',
  },
};

function isFilter(value: string): value is Filter {
  return value in filters;
}

function schedule(task: ScheduledTask) {
  if (!task.enabled) {
    return `${task.description} · Paused`;
  }

  if (!task.nextRunAt) {
    return task.description;
  }

  return `${task.description} · Next run ${untilRun(task.nextRunAt)}`;
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

  const open = () => {
    if (task.conversationId !== null) {
      void navigate({
        params: { id: task.conversationId },
        to: '/c/$id',
      });
    }
  };

  return (
    <li className='group flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-muted/50'>
      <button
        className='flex min-w-0 flex-1 items-center gap-3 text-left outline-none disabled:cursor-default'
        disabled={task.conversationId === null}
        onClick={open}
        type='button'
      >
        <span className='flex size-9 shrink-0 items-center justify-center rounded-full bg-muted'>
          <Clock aria-hidden='true' className='size-4 text-muted-foreground' />
        </span>
        <span className='flex min-w-0 flex-col'>
          <span className='truncate text-sm font-medium'>{task.title}</span>
          <span className='truncate text-sm text-muted-foreground'>
            {schedule(task)}
          </span>
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={`Actions for ${task.title}`}
            className='flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground'
            type='button'
          >
            <Ellipsis aria-hidden='true' className='size-4' />
          </button>
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
            onSelect={() => remove.mutate(task.id)}
            variant='destructive'
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function FilterMenu({
  filter,
  onChange,
}: {
  filter: Filter;
  onChange: (filter: Filter) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className='flex items-center gap-1 rounded-full border px-3 py-1 text-sm outline-none hover:bg-muted'
          type='button'
        >
          {filters[filter].label}
          <ChevronDown aria-hidden='true' className='size-3.5' />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuRadioGroup
          onValueChange={(value) => {
            if (isFilter(value)) {
              onChange(value);
            }
          }}
          value={filter}
        >
          {Object.entries(filters).map(([value, { label }]) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SchedulePrompt() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [draft, setDraft] = useDraft('scheduled');
  const [selectedModel, setModel] = useChatModel();
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const create = useMutation({
    meta: { inlineError: true },
    mutationFn: (content: string) =>
      createConversation(
        `Schedule this task: ${content}`,
        attachments,
        selectedModel
      ),
    onSuccess: async (id) => {
      setDraft('');

      await navigate({ params: { id }, to: '/c/$id' });
      await queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
    },
  });

  return (
    <Composer
      attachments={attachments}
      draft={draft}
      error={create.error?.message}
      model={selectedModel}
      onAttachmentsChange={setAttachments}
      onDraftChange={(value) => {
        if (create.isError) {
          create.reset();
        }

        setDraft(value);
      }}
      onModelChange={setModel}
      onSubmit={(content) => create.mutate(content)}
      placeholder='Schedule a task...'
      submitting={create.isPending}
    />
  );
}

export function Scheduled() {
  const [filter, setFilter] = useState<Filter>('active');

  const schedules = useQuery(schedulesQueryOptions);

  const tasks = schedules.data?.tasks.filter(filters[filter].keep) ?? [];

  return (
    <div className='min-h-0 flex-1 overflow-y-auto'>
      <div className='mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-8'>
        <div className='flex flex-col gap-1'>
          <h1 className='text-2xl font-semibold tracking-tight'>Scheduled</h1>
          <p className='text-sm text-muted-foreground'>
            Lab runs these on a schedule and posts each result to the task’s
            chat.
          </p>
        </div>
        <SchedulePrompt />
        <section className='flex flex-col gap-2'>
          <div className='flex items-center justify-between px-3'>
            <h2 className='text-sm font-medium text-muted-foreground'>Tasks</h2>
            <FilterMenu filter={filter} onChange={setFilter} />
          </div>
          {schedules.isError && (
            <LoadError className='px-3' subject='scheduled tasks' />
          )}
          {schedules.isSuccess && tasks.length === 0 && (
            <p className='px-3 py-6 text-sm text-muted-foreground'>
              {filters[filter].empty}
            </p>
          )}
          <ul className='flex flex-col'>
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
