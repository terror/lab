import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import type { ConversationId } from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import { expect, spyOn, test } from 'bun:test';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { signIn } from '../test/auth';
import { call, create, settle } from '../test/client';
import { script, toolCall } from '../test/models';
import { db } from './db';
import { harness } from './harness';
import { recordHelperUsage } from './helper-usage';
import { projectionPipeline } from './projections';
import { requireOwner } from './records';
import { startRuntime } from './runtime';

test('runtime restarts, cleans failed startup, and drains delegated helper usage after closing storage', async () => {
  const headers = await signIn();

  script(toolCall('delegate', { tasks: [{ prompt: 'foo', title: 'bar' }] }));

  const id = await create(headers);

  await settle(id);

  const ownerId = await requireOwner(id);

  const [child] = await harness().commit(
    async (tx) =>
      (
        await tx.scanConversations(
          { ownerConversationId: id as ConversationId },
          10
        )
      ).items,
    BACKGROUND_CONTEXT
  );

  if (!child) {
    throw new Error('missing subagent');
  }

  await (await startRuntime()).close();

  expect(harness).toThrow('The server runtime has not started');

  const cleanupStarted = Promise.withResolvers<void>();
  const finishCleanup = Promise.withResolvers<void>();

  spyOn(projectionPipeline, 'backfill').mockImplementationOnce(async () => {
    const opened = harness();
    const close = opened.close.bind(opened);

    spyOn(opened, 'close').mockImplementationOnce(async (context) => {
      await close(context);
      cleanupStarted.resolve();
      await finishCleanup.promise;
    });

    throw new Error('foo');
  });

  const failure = startRuntime().catch((error: unknown) =>
    error instanceof Error ? error.message : error
  );

  await cleanupStarted.promise;

  const retry = startRuntime();

  finishCleanup.resolve();

  expect(await failure).toBe('foo');

  const runtime = await retry;

  expect(await startRuntime()).toBe(runtime);

  const locked = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();

  const transaction = db.$client.begin(async (sql) => {
    await sql`lock table usage_event in access exclusive mode`;
    locked.resolve();
    await release.promise;
  });

  await locked.promise;

  recordHelperUsage(id, 'status', fauxAssistantMessage('foo'));
  recordHelperUsage(child.id, 'status', fauxAssistantMessage('bar'));

  const closing = runtime.close();

  expect(runtime.close()).toBe(closing);

  const reopening = startRuntime();

  await runtime.harness.closed;

  release.resolve();
  await transaction;
  await closing;

  expect((await reopening).harness).not.toBe(runtime.harness);

  expect(
    await db
      .select({
        conversationId: schema.usageEvent.conversationId,
        ownerId: schema.usageEvent.ownerId,
      })
      .from(schema.usageEvent)
      .where(
        and(
          eq(schema.usageEvent.conversationId, id),
          eq(schema.usageEvent.kind, 'status')
        )
      )
  ).toEqual([
    { conversationId: id, ownerId },
    { conversationId: id, ownerId },
  ]);

  await startRuntime();
});

const event = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ready'), url: z.url() }),
  z.object({ kind: z.literal('running') }),
]);

function server(hold: boolean) {
  const ready = Promise.withResolvers<string>();
  const running = Promise.withResolvers<void>();

  const child = Bun.spawn({
    cmd: [process.execPath, 'run', 'test/runtime-server.ts'],
    cwd: new URL('..', import.meta.url).pathname,
    env: {
      ...process.env,
      LAB_TEST_HOLD: hold ? '1' : '0',
      NODE_ENV: 'test',
      PORT: '0',
    },
    ipc: (message: unknown) => {
      const value = event.parse(message);

      if (value.kind === 'ready') {
        ready.resolve(value.url);
      } else {
        running.resolve();
      }
    },
    stderr: 'pipe',
    stdout: 'ignore',
  });

  return {
    child,
    errors: new Response(child.stderr).text(),
    ready: ready.promise,
    running: running.promise,
  };
}

test('SIGTERM drains an open event stream and pending work resumes after process restart', async () => {
  const headers = await signIn();
  const id = await create(headers);

  await settle(id);
  await (await startRuntime()).close();

  const first = server(true);

  try {
    const url = await first.ready;
    const response = await fetch(`${url}api/conversations/${id}/messages`, {
      body: JSON.stringify({ content: 'baz' }),
      headers: {
        ...Object.fromEntries(headers),
        'content-type': 'application/json',
      },
      method: 'POST',
    });

    expect(response.status).toBe(202);
    await response.arrayBuffer();
    await first.running;

    const stream = await fetch(`${url}api/conversations/${id}/events`, {
      headers,
    });
    const ended = stream.text();

    first.child.kill('SIGTERM');

    expect({
      code: await first.child.exited,
      errors: await first.errors,
    }).toEqual({ code: 0, errors: '' });
    await ended;
  } finally {
    first.child.kill();
  }

  const second = server(false);

  try {
    const url = await second.ready;

    for (let attempt = 0; attempt < 100; attempt++) {
      const response = await fetch(`${url}api/conversations/${id}`, {
        headers,
      });
      const body = z
        .object({ running: z.boolean() })
        .parse(await response.json());

      if (!body.running) {
        break;
      }

      await Bun.sleep(10);
    }

    second.child.kill('SIGTERM');

    expect({
      code: await second.child.exited,
      errors: await second.errors,
    }).toEqual({ code: 0, errors: '' });
  } finally {
    second.child.kill();
    await startRuntime();
  }

  const { body } = await call(
    headers,
    'GET',
    `/conversations/${id}/entries?order=ascending`
  );

  expect(
    body.items.flatMap(
      (entry: { model?: { role: string; content: unknown }[] }) =>
        entry.model
          ?.filter(({ role }) => role === 'assistant')
          .map(({ content }) => content) ?? []
    )
  ).toEqual([[{ type: 'text', text: 'foo' }], [{ type: 'text', text: 'bar' }]]);
}, 15_000);
