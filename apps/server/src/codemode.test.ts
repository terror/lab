import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { DeadlineSandbox, workerSlots } from '@lab/harness';
import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call, chat, idle, toolOutputs } from '../test/client';
import { script, toolCall } from '../test/models';

test('the agent can run code that calls other tools', async () => {
  const headers = await signIn();

  script(
    toolCall('codemode', {
      code: 'const found = await tools.library_search({ query: "foo" }); return [1 + 2, found];',
    }),
    fauxAssistantMessage('bar')
  );

  const { body } = await call(headers, 'POST', '/conversations', {
    content: 'foo',
  });

  await idle(body.id);

  const entries = await call(
    headers,
    'GET',
    `/conversations/${body.id}/entries?order=ascending`
  );

  const outputs = entries.body.items.flatMap(
    ({ model }: { model?: { content: { text?: string }[]; role: string }[] }) =>
      model?.[0]?.role === 'toolResult'
        ? [model[0].content.map(({ text }) => text).join('')]
        : []
  );

  expect(outputs).toHaveLength(1);

  expect(outputs[0]).toMatch(
    /^Script completed\nWall time \d+\.\d seconds\nOutput:\n\[3,"No matching files\."\]$/
  );
});

test('scripts cannot grow past the memory cap', async () => {
  const headers = await signIn();

  script(
    toolCall('codemode', {
      code: 'return "a".repeat(200 * 1024 * 1024).length;',
    }),
    fauxAssistantMessage('bar')
  );

  const outputs = await toolOutputs(
    headers,
    await chat(headers, { content: 'foo' })
  );

  expect(outputs).toHaveLength(1);

  expect(outputs[0]).toMatch(
    /^Script failed\nWall time \d+\.\d seconds\nOutput:\nScript error:\nInternalError: out of memory\n {4}at <anonymous> \(codemode\.js:1:\d+\)\n\nNo tool calls were made\.$/
  );
});

test('scripts stop at the default deadline, and never after the longest one', async () => {
  const sandbox = new DeadlineSandbox({ maxTimeoutMs: 200, timeoutMs: 100 });

  async function timeout(requested: number | undefined, actual: number) {
    const { result } = sandbox.start('while (true) {}', {
      onCall: () => undefined,
      seed: 0,
      startedAt: 0,
      timeoutMs: requested,
    });

    expect(await result).toEqual({
      calls: [],
      error: {
        kind: 'timeout',
        message: `Execution timed out after ${actual} ms`,
      },
      ok: false,
      output: [],
    });
  }

  await timeout(undefined, 100);
  await timeout(150, 150);
  await timeout(60_000, 200);

  await sandbox.close();
});

test('scripts past the limit are refused until a running one exits', async () => {
  const exits = new Array<Promise<void>>();

  const sandbox = new DeadlineSandbox({
    acquireWorker: workerSlots(1),
    maxTimeoutMs: 200,
    onWorkerStarted: (exited) => {
      exits.push(exited);
    },
    timeoutMs: 200,
  });

  const start = (code: string) =>
    sandbox.start(code, { onCall: () => undefined, seed: 0, startedAt: 0 })
      .result;

  const running = start('while (true) {}');

  expect(await start('return "foo";')).toEqual({
    calls: [],
    error: {
      kind: 'sandbox',
      message: 'Too many scripts are running. Try again once one ends.',
    },
    ok: false,
    output: [],
  });

  await running;

  await Promise.all(exits);

  expect(await start('return "bar";')).toEqual({
    calls: [],
    during: { issued: 0, seq: 0 },
    ok: true,
    output: [],
    storeWrites: { delete: [], set: {} },
    value: 'bar',
  });

  await sandbox.close();
});
