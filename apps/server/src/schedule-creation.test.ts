import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { schema } from '@lab/db';
import {
  type ScheduleAccess,
  type ScheduledTask,
  QuestionsDoc,
  openHarness,
} from '@lab/harness';
import { expect, spyOn, test } from 'bun:test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { signIn } from '../test/auth';
import { call, pendingToolCall, settle } from '../test/client';
import { emptyDeps } from '../test/harness';
import { script, toolCall } from '../test/models';
import { db } from './db';
import { harness } from './harness';
import { models } from './models';
import { deleteTask, listTasks, scheduleAccess } from './schedule-access';

const input = {
  cron: '0 9 * * *',
  description: 'foo',
  prompt: 'bar',
  timezone: 'UTC',
  title: 'baz',
};

test('concurrent retries share a schedule and separate calls create their own', async () => {
  const headers = await signIn();

  const create = scheduleAccess.create.bind(scheduleAccess);

  const attempts: Awaited<ReturnType<typeof create>>[][] = [];

  spyOn(scheduleAccess, 'create').mockImplementation(async (...args) => {
    const results = await Promise.all([create(...args), create(...args)]);

    attempts.push(results);

    return results[0];
  });

  async function ask() {
    script(toolCall('schedule_create', input), fauxAssistantMessage('qux'));

    const { body } = await call(headers, 'POST', '/conversations', {
      content: 'foo',
    });

    await call(headers, 'POST', `/conversations/${body.id}/answers`, {
      answer: 'approved',
      callId: await pendingToolCall(headers, body.id),
    });

    await settle(body.id);

    return body.id;
  }

  const chats = [await ask(), await ask()];

  const { tasks } = (await call(headers, 'GET', '/schedules')).body;

  expect({
    attempts,
    chats: tasks.map(({ conversationId }: ScheduledTask) => conversationId),
  }).toEqual({
    attempts: [
      [tasks[0], tasks[0]],
      [tasks[1], tasks[1]],
    ],
    chats,
  });
});

async function recover(deleted: boolean) {
  const ownerId = crypto.randomUUID();

  await db.insert(schema.user).values({
    createdAt: new Date(),
    email: `${ownerId}@example.com`,
    id: ownerId,
    name: 'foo',
  });

  const source = await harness.createConversation(
    { ownership: { kind: 'ownerless' } },
    BACKGROUND_CONTEXT
  );

  await db.insert(schema.conversation).values({ id: source.id, ownerId });

  const access = {
    ...scheduleAccess,
    create: ({ taskId }, fields) =>
      scheduleAccess.create({ conversationId: source.id, taskId }, fields),
  } satisfies ScheduleAccess;

  const created =
    Promise.withResolvers<Awaited<ReturnType<ScheduleAccess['create']>>>();

  const released = Promise.withResolvers<void>();

  const create = access.create;

  const held = spyOn(access, 'create').mockImplementationOnce(
    async (...args) => {
      const task = await create(...args);

      created.resolve(task);
      await released.promise;

      return task;
    }
  );

  const options = {
    ...emptyDeps(),
    models,
    owner: async () => ownerId,
    path: join(await mkdtemp(join(tmpdir(), 'lab-')), 'lab.sqlite'),
    schedule: access,
  };

  const first = await openHarness(options);

  script(toolCall('schedule_create', input, 'foo'));

  const conversation = await first.createConversation(
    {
      agent: {
        model: {
          modelId: 'anthropic/claude-sonnet-5.5',
          provider: 'vercel-ai-gateway',
        },
      },
      ownership: { kind: 'ownerless' },
    },
    BACKGROUND_CONTEXT
  );

  await conversation.commit(async (tx) => {
    (await tx.doc(QuestionsDoc, conversation.id)).answers.foo = 'approved';
  }, BACKGROUND_CONTEXT);

  await conversation.submit(
    { content: 'foo', type: 'input' },
    BACKGROUND_CONTEXT
  );

  const saved = await created.promise;

  const closing = first.close(BACKGROUND_CONTEXT);

  released.resolve();
  await closing;
  held.mockRestore();

  if (!saved) {
    throw new Error('The task was not created');
  }

  if (deleted) {
    await deleteTask(ownerId, saved.id);
  }

  const second = await openHarness(options);

  const reopened = await second.conversation(
    conversation.id,
    BACKGROUND_CONTEXT
  );

  await reopened?.waitForIdle(BACKGROUND_CONTEXT);

  const page = await reopened?.entries({}, 100, undefined, BACKGROUND_CONTEXT);

  const outputs = (page?.items ?? []).flatMap(({ model }) => {
    const message = model?.[0];

    return message?.role === 'toolResult' ? [message.content] : [];
  });

  await second.close(BACKGROUND_CONTEXT);

  expect({ outputs, tasks: await listTasks(ownerId) }).toEqual({
    outputs: [
      [
        {
          text: deleted
            ? 'This scheduled task was deleted.'
            : `Scheduled [${saved.id}] baz: foo (0 9 * * *, UTC, next run ${saved.nextRunAt}).`,
          type: 'text',
        },
      ],
    ],
    tasks: deleted ? [] : [saved],
  });
}

test('schedule creation survives a restart without duplicating or restoring deleted tasks', async () => {
  await recover(false);
  await recover(true);
});
