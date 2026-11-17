import {
  type ConversationId,
  type ToolExecutionResult,
  defineExtension,
  defineTool,
  section,
} from '@earendil-works/pi-durable';
import { bool, int, obj, opt, str } from '@earendil-works/pi-schema';

import { requestApproval } from './host-input';
import { failure, once, text } from './results';
import { type Owner, userDoc } from './users';

export type ScheduledTask = {
  conversationId: number | null;
  cron: string;
  description: string;
  enabled: boolean;
  id: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  prompt: string;
  timezone: string;
  title: string;
};

export type ScheduleInput = Pick<
  ScheduledTask,
  'cron' | 'description' | 'prompt' | 'timezone' | 'title'
>;

export type ScheduleChange = Partial<ScheduleInput> & { enabled?: boolean };

export type ScheduleUpdate =
  | { kind: 'invalid'; message: string }
  | { kind: 'missing' }
  | { kind: 'updated'; task: ScheduledTask };

export type ScheduleAccess = {
  create(
    conversationId: ConversationId,
    input: ScheduleInput
  ): Promise<ScheduledTask>;
  delete(
    conversationId: ConversationId,
    id: number
  ): Promise<ScheduledTask | undefined>;
  invalid(cron: string, timezone: string): string | undefined;
  list(conversationId: ConversationId): Promise<ScheduledTask[]>;
  update(
    conversationId: ConversationId,
    id: number,
    change: ScheduleChange
  ): Promise<ScheduleUpdate>;
};

export const ProfileDoc = userDoc<{ timezone: string }>(
  'lab.user.profile',
  () => ({ timezone: 'UTC' })
);

function line(task: ScheduledTask) {
  const state = task.enabled
    ? `next run ${task.nextRunAt ?? 'not scheduled'}`
    : 'paused';

  return `[${task.id}] ${task.title}: ${task.description} (${task.cron}, ${task.timezone}, ${state})`;
}

const cron = str({
  description:
    'A five-field cron expression (minute hour day month weekday) for when the task runs.',
  maxLength: 100,
  minLength: 9,
});

const description = str({
  description:
    'A short human description of the schedule, like "Every weekday at 9am".',
  maxLength: 100,
  minLength: 1,
});

const prompt = str({
  description:
    'The message Lab sends itself each time the task runs. Write it as a complete request.',
  maxLength: 4_000,
  minLength: 1,
});

const title = str({
  description: 'A short name for the task.',
  maxLength: 80,
  minLength: 1,
});

const timezone = str({
  description: "An IANA timezone. Defaults to the user's timezone.",
  maxLength: 64,
  minLength: 1,
});

const id = int({ description: 'The scheduled task id.', minimum: 1 });

const missing = 'No scheduled task has that id.';

function updateResult(result: ScheduleUpdate): ToolExecutionResult {
  if (result.kind === 'invalid') {
    return failure(result.message);
  }

  if (result.kind === 'missing') {
    return failure(missing);
  }

  return {
    details: { task: result.task },
    output: text(`Updated ${line(result.task)}.`),
  };
}

export function schedule(access: ScheduleAccess, owner: Owner) {
  const scheduleCreate = defineTool({
    name: 'schedule_create',
    description:
      'Schedule a task that runs a prompt on a recurring schedule in this chat. The user must approve it first.',
    callers: ['model'],
    replay: 'safe',
    parameters: obj({
      cron,
      description,
      prompt,
      timezone: opt(timezone),
      title,
    }),
    execute: async (args, api, context): Promise<ToolExecutionResult> => {
      const zone =
        args.timezone ??
        (
          await api.snapshot(
            ProfileDoc,
            await owner(api.conversationId),
            context
          )
        )?.timezone ??
        'UTC';

      const invalid = access.invalid(args.cron, zone);

      if (invalid) {
        return failure(invalid);
      }

      const { approval, approved } = await requestApproval(api, context, {
        action: `Schedule “${args.title}”`,
        summary: [`${args.description} (${zone})`, args.prompt],
      });

      if (!approved) {
        return {
          details: { approval },
          output: text('The user declined to schedule this task.'),
        };
      }

      const task = await once(api, 'task', context, () =>
        access.create(api.conversationId, { ...args, timezone: zone })
      );

      return {
        details: { approval, task },
        output: text(`Scheduled ${line(task)}.`),
      };
    },
  });

  const scheduleList = defineTool({
    name: 'schedule_list',
    description: "List the user's scheduled tasks.",
    parameters: obj({}),
    execute: async (_args, api): Promise<ToolExecutionResult> => {
      const tasks = await access.list(api.conversationId);

      return {
        details: { count: tasks.length, tasks },
        output: text(
          tasks.length > 0 ? tasks.map(line).join('\n') : 'No scheduled tasks.'
        ),
      };
    },
  });

  const scheduleUpdate = defineTool({
    name: 'schedule_update',
    description:
      "Change a scheduled task's title, prompt, schedule, or pause and resume it. Only the fields you pass change.",
    parameters: obj({
      cron: opt(cron),
      description: opt(description),
      enabled: opt(
        bool({ description: 'False pauses the task, true resumes it.' })
      ),
      id,
      prompt: opt(prompt),
      timezone: opt(timezone),
      title: opt(title),
    }),
    execute: async (
      { id: taskId, ...change },
      api
    ): Promise<ToolExecutionResult> => {
      const result = await access.update(api.conversationId, taskId, change);

      return updateResult(result);
    },
  });

  const scheduleDelete = defineTool({
    name: 'schedule_delete',
    description: 'Delete a scheduled task.',
    parameters: obj({ id }),
    execute: async (args, api): Promise<ToolExecutionResult> => {
      const task = await access.delete(api.conversationId, args.id);

      return task
        ? { details: { task }, output: text(`Deleted ${line(task)}.`) }
        : failure(missing);
    },
  });

  return defineExtension({
    name: 'lab.schedule',
    sections: [
      section('schedule', async ({ conversationId, read }, context) => {
        const zone =
          (
            await read.snapshot(
              ProfileDoc,
              await owner(conversationId),
              context
            )
          )?.timezone ?? 'UTC';

        const now = new Intl.DateTimeFormat('en-US', {
          dateStyle: 'full',
          timeStyle: 'short',
          timeZone: zone,
        }).format(new Date());

        return `The user's timezone is ${zone}, where it is now ${now}. You can schedule recurring tasks with schedule_create (the user approves each one), and list, change, pause, or delete them with schedule_list, schedule_update, and schedule_delete.`;
      }),
    ],
    tools: [scheduleCreate, scheduleDelete, scheduleList, scheduleUpdate],
  });
}
