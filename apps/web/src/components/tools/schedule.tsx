import { CalendarClock } from 'lucide-react';

import { count, field, plural, text } from './format';
import type { ToolRenderer, ToolView } from './types';

function taskTitle(running: string, done: string) {
  return ({ active, details }: ToolView) => {
    const name = text(field(field(details, 'task'), 'title'));

    if (active) {
      return running;
    }

    return name ? `${done} “${name}”` : `${done} a task`;
  };
}

export const scheduleRenderers: Record<string, ToolRenderer> = {
  schedule_create: {
    icon: CalendarClock,
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
    title: taskTitle('Deleting a scheduled task', 'Deleted'),
  },
  schedule_list: {
    icon: CalendarClock,
    summary: ({ details }) => {
      const found = count(field(details, 'count'));

      return found === undefined ? undefined : plural(found, 'task');
    },
    title: ({ active }) =>
      active ? 'Listing scheduled tasks' : 'Listed scheduled tasks',
  },
  schedule_update: {
    icon: CalendarClock,
    title: taskTitle('Updating a scheduled task', 'Updated'),
  },
};
