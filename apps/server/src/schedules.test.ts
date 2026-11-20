import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { schema } from '@lab/db';
import { expect, spyOn, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { signIn } from '../test/auth';
import {
  call,
  pendingToolCall,
  settle,
  toolDetails,
  toolOutputs,
} from '../test/client';
import { script, toolCall } from '../test/models';
import { db } from './db';
import { env } from './env';
import { harness } from './harness';
import { models } from './models';
import { runDueTasks } from './scheduler';

const task = {
  cron: '0 9 * * *',
  description: 'Every day at 9am',
  prompt: 'bar',
  timezone: 'UTC',
  title: 'foo',
};

async function ask(headers: Headers, answer: string) {
  script(toolCall('schedule_create', task), fauxAssistantMessage('baz'));

  const { body } = await call(headers, 'POST', '/conversations', {
    content: 'foo',
  });

  const callId = await pendingToolCall(headers, body.id);

  await call(headers, 'POST', `/conversations/${body.id}/answers`, {
    answer,
    callId,
  });

  await settle(body.id);

  return { id: body.id, outputs: await toolOutputs(headers, body.id) };
}

test('scheduled tasks need approval and run once when due', async () => {
  const headers = await signIn();

  const denied = await ask(headers, 'denied');

  const approved = await ask(headers, 'approved');

  const [created] = (await call(headers, 'GET', '/schedules')).body.tasks;

  await db
    .update(schema.scheduledTask)
    .set({ nextRunAt: new Date('2026-01-01T00:00:00Z') })
    .where(eq(schema.scheduledTask.id, created.id));

  const now = new Date('2026-01-01T00:00:30Z');

  await Promise.all([runDueTasks(now), runDueTasks(now)]);

  const [ran] = await db
    .select()
    .from(schema.scheduledTask)
    .where(eq(schema.scheduledTask.id, created.id));

  await settle(ran?.conversationId ?? undefined);

  const chats = await db
    .select({ title: schema.conversation.title })
    .from(schema.conversation)
    .where(eq(schema.conversation.id, ran?.conversationId ?? 0));

  const listed = await call(headers, 'GET', '/schedules');

  script(
    toolCall('schedule_update', { id: created.id, timezone: 'Foo/Bar' }),
    fauxAssistantMessage('baz')
  );

  const updating = await call(headers, 'POST', '/conversations', {
    content: 'foo',
  });

  await settle(updating.body.id);

  const invalid = await toolOutputs(headers, updating.body.id);

  script(
    toolCall('schedule_update', { cron: '* * * * *', id: created.id }),
    fauxAssistantMessage('baz')
  );

  const retiming = await call(headers, 'POST', '/conversations', {
    content: 'foo',
  });

  await call(headers, 'POST', `/conversations/${retiming.body.id}/answers`, {
    answer: 'denied',
    callId: await pendingToolCall(headers, retiming.body.id),
  });

  await settle(retiming.body.id);

  const approvals = [
    ...(await toolDetails(headers, approved.id)),
    ...(await toolDetails(headers, retiming.body.id)),
  ].map((detail) => z.object({ approval: z.unknown() }).parse(detail).approval);

  const paused = await call(headers, 'PATCH', `/schedules/${created.id}`, {
    enabled: false,
  });

  await call(headers, 'DELETE', `/schedules/${created.id}`);

  expect({
    approvals,
    approved: approved.outputs,
    chat: [created.conversationId, ran?.conversationId],
    chats: chats.length,
    conversationId: listed.body.tasks[0].conversationId,
    denied: denied.outputs,
    invalid,
    lastRunAt: ran?.lastRunAt?.toISOString(),
    nextRunAt: ran?.nextRunAt?.toISOString(),
    paused: [paused.body.task.enabled, paused.body.task.nextRunAt],
    remaining: (await call(headers, 'GET', '/schedules')).body.tasks,
  }).toEqual({
    approvals: [
      {
        action: 'Schedule “foo”',
        decision: 'approved',
        summary: ['Every day at 9am (0 9 * * *, UTC)', 'bar'],
      },
      {
        action: 'Change a scheduled task',
        decision: 'denied',
        summary: ['Task: foo', 'Cron: * * * * *'],
      },
    ],
    approved: [
      `Scheduled [${created.id}] foo: Every day at 9am (0 9 * * *, UTC, next run ${created.nextRunAt}).`,
    ],
    chat: [approved.id, approved.id],
    chats: 1,
    conversationId: ran?.conversationId,
    denied: ['The user declined to schedule this task.'],
    invalid: ['Unknown timezone: Foo/Bar'],
    lastRunAt: '2026-01-01T00:00:30.000Z',
    nextRunAt: '2026-01-01T09:00:00.000Z',
    paused: [false, null],
    remaining: [],
  });
});

test('the reported timezone must be a known one', async () => {
  const headers = await signIn();

  expect(
    await call(headers, 'PUT', '/schedules/timezone', { timezone: 'Foo/Bar' })
  ).toEqual({
    body: { error: '✖ Unknown timezone\n  → at timezone' },
    status: 400,
  });
});

test('tasks skip runs while their chat is in the trash', async () => {
  const headers = await signIn();

  const { id } = await ask(headers, 'approved');

  const [created] = (await call(headers, 'GET', '/schedules')).body.tasks;

  await call(headers, 'DELETE', `/conversations/${id}`);

  await db
    .update(schema.scheduledTask)
    .set({ nextRunAt: new Date('2026-01-01T00:00:00Z') })
    .where(eq(schema.scheduledTask.id, created.id));

  await runDueTasks(new Date('2026-01-01T00:00:30Z'));

  const [ran] = await db
    .select()
    .from(schema.scheduledTask)
    .where(eq(schema.scheduledTask.id, created.id));

  const trashed = {
    chats: (await call(headers, 'GET', '/conversations?filter=all')).body
      .conversations,
    listed: (await call(headers, 'GET', '/schedules')).body.tasks[0]
      .conversationId,
    run: await call(headers, 'POST', `/schedules/${created.id}/run`),
    searched: (await call(headers, 'GET', '/search?q=foo')).body.schedules[0]
      .conversationId,
    stored: ran?.conversationId,
  };

  await call(headers, 'POST', `/trash/conversation/${id}/restore`);

  expect({
    restored: (await call(headers, 'GET', '/schedules')).body.tasks[0]
      .conversationId,
    trashed,
  }).toEqual({
    restored: id,
    trashed: {
      chats: [],
      listed: null,
      run: {
        body: { error: 'This task’s chat is in the Trash' },
        status: 409,
      },
      searched: null,
      stored: id,
    },
  });
});

test('changing what a task does asks first, and removed users’ tasks stop', async () => {
  const headers = await signIn();

  await ask(headers, 'approved');

  const [created] = (await call(headers, 'GET', '/schedules')).body.tasks;

  script(
    toolCall('schedule_update', { id: created.id, prompt: 'qux' }, 'qux'),
    fauxAssistantMessage('baz')
  );

  const { body } = await call(headers, 'POST', '/conversations', {
    content: 'foo',
  });

  await call(headers, 'POST', `/conversations/${body.id}/answers`, {
    answer: 'denied',
    callId: 'qux',
  });

  await settle(body.id);

  const declined = await toolOutputs(headers, body.id);

  await db
    .update(schema.scheduledTask)
    .set({ nextRunAt: new Date('2026-01-01T00:00:00Z') })
    .where(eq(schema.scheduledTask.id, created.id));

  env.LAB_ALLOWED_EMAILS = [];

  try {
    await runDueTasks(new Date('2026-01-01T00:00:30Z'));
  } finally {
    env.LAB_ALLOWED_EMAILS = ['*'];
  }

  const [stored] = await db
    .select({
      lastRunAt: schema.scheduledTask.lastRunAt,
      prompt: schema.scheduledTask.prompt,
    })
    .from(schema.scheduledTask)
    .where(eq(schema.scheduledTask.id, created.id));

  expect({ declined, stored }).toEqual({
    declined: ['The user declined to change this task.'],
    stored: { lastRunAt: null, prompt: 'bar' },
  });
});

test('running a task with no provider asks for one', async () => {
  const headers = await signIn();

  await ask(headers, 'approved');

  const [created] = (await call(headers, 'GET', '/schedules')).body.tasks;

  await db
    .update(schema.scheduledTask)
    .set({ conversationId: null })
    .where(eq(schema.scheduledTask.id, created.id));

  spyOn(models, 'getAvailable').mockResolvedValue([]);

  expect(await call(headers, 'POST', `/schedules/${created.id}/run`)).toEqual({
    body: { error: 'Add a provider in settings to start chatting' },
    status: 400,
  });
});

test('a task says whether its chat is running', async () => {
  const headers = await signIn();

  await ask(headers, 'approved');

  const [created] = (await call(headers, 'GET', '/schedules')).body.tasks;

  const inspection = await harness.inspect(BACKGROUND_CONTEXT);

  spyOn(harness, 'inspect').mockResolvedValueOnce({
    ...inspection,
    tasks: [
      {
        record: { background: false, conversationId: created.conversationId },
        state: { kind: 'running' },
      } as (typeof inspection.tasks)[number],
    ],
  });

  const { tasks } = (await call(headers, 'GET', '/schedules')).body;

  expect({
    before: created.running,
    during: tasks.map(({ id, running }: { id: number; running: boolean }) => ({
      id,
      running,
    })),
  }).toEqual({ before: false, during: [{ id: created.id, running: true }] });
});
