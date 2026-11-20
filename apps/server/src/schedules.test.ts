import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { schema } from '@lab/db';
import { ScheduledChatsDoc } from '@lab/harness';
import { expect, mock, spyOn, test } from 'bun:test';
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
import { harness, openLabHarness } from './harness';
import { models } from './models';
import { startPipelines } from './pipelines';
import { runDueTasks, startScheduler } from './scheduler';

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

async function messages(headers: Headers, id: number) {
  const { body } = await call(
    headers,
    'GET',
    `/conversations/${id}/entries?order=ascending`
  );

  return z
    .object({
      items: z.array(
        z.object({ data: z.unknown().optional(), kind: z.string() })
      ),
    })
    .parse(body)
    .items.filter(({ kind }) => kind === 'lab.message')
    .map(({ data }) => z.object({ text: z.string() }).parse(data).text);
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

test('scheduled occurrences survive failed submission and failed acknowledgement', async () => {
  async function runCase(
    fresh: boolean,
    phase: 'before' | 'created' | 'accepted'
  ) {
    const headers = await signIn();

    const original = await ask(headers, 'approved');

    const [created] = (await call(headers, 'GET', '/schedules')).body.tasks;

    const due = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-01T00:00:30Z');

    const [row] = await db
      .update(schema.scheduledTask)
      .set({
        conversationId: fresh ? null : original.id,
        nextRunAt: due,
      })
      .where(eq(schema.scheduledTask.id, created.id))
      .returning();

    if (!row) {
      throw new Error('No scheduled task');
    }

    const failure = new Error('foo');
    const errors = spyOn(console, 'error').mockImplementation(() => undefined);
    const transaction = db.transaction.bind(db);

    function fail() {
      if (phase === 'accepted') {
        return spyOn(db, 'transaction').mockImplementationOnce((run, config) =>
          transaction(async (tx) => {
            await run(tx);
            throw failure;
          }, config)
        );
      }

      if (phase === 'created') {
        const create = harness.createConversation.bind(harness);

        return spyOn(harness, 'createConversation').mockImplementationOnce(
          async (options, context) => {
            await create(options, context);
            throw failure;
          }
        );
      }

      return fresh
        ? spyOn(models, 'getAvailable').mockRejectedValueOnce(failure)
        : spyOn(harness, 'commit').mockRejectedValueOnce(failure);
    }

    const failing = fail();

    await runDueTasks(now);
    failing.mockRestore();

    const [pending] = (await call(headers, 'GET', '/schedules')).body.tasks;

    const target = (
      await harness.snapshot(ScheduledChatsDoc, row.ownerId, BACKGROUND_CONTEXT)
    )?.[String(row.id)];

    await settle(target ?? original.id);
    await harness.close(BACKGROUND_CONTEXT);
    await openLabHarness();
    startPipelines();

    await Promise.all([runDueTasks(now), runDueTasks(now)]);

    const [ran] = (await call(headers, 'GET', '/schedules')).body.tasks;

    await settle(ran.conversationId);

    expect({
      chats: (await call(headers, 'GET', '/conversations')).body.conversations
        .length,
      errors: errors.mock.calls,
      messages: await messages(headers, ran.conversationId),
      pending: [pending.lastRunAt, pending.nextRunAt],
      ran: [ran.lastRunAt, ran.nextRunAt],
      reused:
        fresh && phase !== 'before' ? ran.conversationId === target : true,
    }).toEqual({
      chats: fresh ? 2 : 1,
      errors: [[failure]],
      messages: fresh ? ['bar'] : ['foo', 'bar'],
      pending: [null, due.toISOString()],
      ran: [now.toISOString(), '2026-01-01T09:00:00.000Z'],
      reused: true,
    });

    await call(headers, 'DELETE', `/schedules/${created.id}`);

    expect(
      await harness.snapshot(ScheduledChatsDoc, row.ownerId, BACKGROUND_CONTEXT)
    ).toEqual({});

    errors.mockRestore();
  }

  await runCase(false, 'before');
  await runCase(false, 'accepted');
  await runCase(true, 'before');
  await runCase(true, 'created');
  await runCase(true, 'accepted');
});

test('polls recheck tasks paused or deleted after selection', async () => {
  async function runCase(method: 'PATCH' | 'DELETE') {
    const headers = await signIn();
    const original = await ask(headers, 'approved');
    const [created] = (await call(headers, 'GET', '/schedules')).body.tasks;

    await db
      .update(schema.scheduledTask)
      .set({ nextRunAt: new Date('2026-01-01T00:00:00Z') })
      .where(eq(schema.scheduledTask.id, created.id));

    const transaction = db.transaction.bind(db);
    const interrupted = spyOn(db, 'transaction').mockImplementationOnce(
      async (run, config) => {
        await call(headers, method, `/schedules/${created.id}`, {
          enabled: false,
        });

        return transaction(run, config);
      }
    );

    await runDueTasks(new Date('2026-01-01T00:00:30Z'));
    interrupted.mockRestore();
    await settle(original.id);

    expect(await messages(headers, original.id)).toEqual(['foo']);

    const manual = await call(headers, 'POST', `/schedules/${created.id}/run`);

    await settle(original.id);

    expect(manual).toEqual(
      method === 'PATCH'
        ? {
            body: {
              task: {
                ...created,
                enabled: false,
                lastRunAt: expect.any(String),
                nextRunAt: null,
              },
            },
            status: 200,
          }
        : { body: { error: 'Scheduled task not found' }, status: 404 }
    );

    expect(await messages(headers, original.id)).toEqual(
      method === 'PATCH' ? ['foo', 'bar'] : ['foo']
    );

    await call(headers, 'DELETE', `/schedules/${created.id}`);
  }

  await runCase('PATCH');
  await runCase('DELETE');
});

test('stopping the scheduler drains its poll without overlapping ticks', async () => {
  const headers = await signIn();
  const original = await ask(headers, 'approved');
  const [created] = (await call(headers, 'GET', '/schedules')).body.tasks;

  await db
    .update(schema.scheduledTask)
    .set({ nextRunAt: new Date('2026-01-01T00:00:00Z') })
    .where(eq(schema.scheduledTask.id, created.id));

  const transaction = db.transaction.bind(db);
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const transactions = spyOn(db, 'transaction').mockImplementationOnce(
    async (run, config) => {
      entered.resolve();
      await release.promise;
      return transaction(run, config);
    }
  );
  const timer = spyOn(globalThis, 'setInterval');
  const stopped = mock(() => undefined);
  const stop = startScheduler();

  await entered.promise;
  timer.mock.calls[0]?.[0]();

  const stopping = stop().then(() => stopped());

  await Bun.sleep(0);

  expect([stopped.mock.calls.length, transactions.mock.calls.length]).toEqual([
    0, 1,
  ]);

  release.resolve();
  await stopping;
  await stop();
  await settle(original.id);

  expect(await messages(headers, original.id)).toEqual(['foo', 'bar']);

  await call(headers, 'DELETE', `/schedules/${created.id}`);
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
