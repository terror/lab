import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { DeadlineSandbox } from '@lab/harness';
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
      code: 'return "a".repeat(300 * 1024 * 1024).length;',
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

test('scripts without their own timeout stop at the default deadline', async () => {
  const sandbox = new DeadlineSandbox({ timeoutMs: 100 });

  const { result } = sandbox.start('while (true) {}', {
    onCall: () => undefined,
    seed: 0,
    startedAt: 0,
  });

  expect(await result).toEqual({
    calls: [],
    error: { kind: 'timeout', message: 'Execution timed out after 100 ms' },
    ok: false,
    output: [],
  });

  await sandbox.close();
});
