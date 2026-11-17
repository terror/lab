import { untilRun } from '@/lib/time';
import { CalendarClock } from 'lucide-react';

import { count, field, namedTitle, plural, text } from './format';
import { PreviewList, PreviewPassage } from './previews';
import type { ToolRenderer, ToolView } from './types';

function schedule(task: unknown) {
  const description = text(field(task, 'description')) ?? '';

  const next = text(field(task, 'nextRunAt'));

  if (field(task, 'enabled') === false) {
    return `${description} · Paused`;
  }

  return next ? `${description} · Next run ${untilRun(next)}` : description;
}

function taskPreview({ details }: ToolView) {
  const task = field(details, 'task');

  const prompt = text(field(task, 'prompt'));

  if (!prompt) {
    return undefined;
  }

  return (
    <div className='flex flex-col gap-1.5'>
      <p className='text-sm text-muted-foreground'>{schedule(task)}</p>
      <PreviewPassage>{prompt}</PreviewPassage>
    </div>
  );
}

const taskTitle = namedTitle(
  ({ details }) => field(field(details, 'task'), 'title'),
  { unnamed: 'a task' }
);

export const scheduleRenderers = {
  schedule_create: {
    icon: CalendarClock,
    preview: taskPreview,
    title: (view) => {
      const decision = text(field(field(view.details, 'approval'), 'decision'));

      if (decision === 'denied') {
        return 'Didn’t schedule a task';
      }

      return taskTitle('Scheduling a task', 'Scheduled')(view);
    },
  },
  schedule_delete: {
    icon: CalendarClock,
    preview: taskPreview,
    title: taskTitle('Deleting a scheduled task', 'Deleted'),
  },
  schedule_list: {
    icon: CalendarClock,
    preview: ({ details }) => {
      const tasks = field(details, 'tasks');

      if (!Array.isArray(tasks)) {
        return undefined;
      }

      return (
        <PreviewList
          items={tasks.map((task: unknown, index) => ({
            key: String(count(field(task, 'id')) ?? index),
            label: text(field(task, 'title')) ?? 'Untitled task',
            meta: schedule(task),
          }))}
        />
      );
    },
    summary: ({ details }) => {
      const found = count(field(details, 'count'));

      return found === undefined ? undefined : plural(found, 'task');
    },
    title: ({ active }) =>
      active ? 'Listing scheduled tasks' : 'Listed scheduled tasks',
  },
  schedule_update: {
    icon: CalendarClock,
    preview: taskPreview,
    title: taskTitle('Updating a scheduled task', 'Updated'),
  },
} satisfies Record<string, ToolRenderer>;
