import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { schema } from '@lab/db';
import { expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';

import { signIn } from '../test/auth';
import { call, pendingToolCall, settle, toolOutputs } from '../test/client';
import { script, toolCall } from '../test/models';
import { db } from './db';
import { runDueTasks } from './schedules';

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

  return toolOutputs(headers, body.id);
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

  const paused = await call(headers, 'PATCH', `/schedules/${created.id}`, {
    enabled: false,
  });

  await call(headers, 'DELETE', `/schedules/${created.id}`);

  expect({
    approved,
    chats: chats.length,
    conversationId: listed.body.tasks[0].conversationId,
    denied,
    invalid,
    lastRunAt: ran?.lastRunAt?.toISOString(),
    nextRunAt: ran?.nextRunAt?.toISOString(),
    paused: [paused.body.task.enabled, paused.body.task.nextRunAt],
    remaining: (await call(headers, 'GET', '/schedules')).body.tasks,
  }).toEqual({
    approved: [
      `Scheduled [${created.id}] foo: Every day at 9am (0 9 * * *, UTC, next run ${created.nextRunAt}).`,
    ],
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
