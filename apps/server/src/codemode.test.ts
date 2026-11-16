import { fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai';
import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call, idle } from '../test/client';
import { script } from '../test/models';

test('the agent can run code that calls other tools', async () => {
  const headers = await signIn();

  script(
    fauxAssistantMessage(
      fauxToolCall('codemode', {
        code: 'const found = await tools.library_search({ query: "foo" }); return [1 + 2, found];',
      }),
      { stopReason: 'toolUse' }
    ),
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
