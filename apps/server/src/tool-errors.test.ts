import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { chat, toolDetails } from '../test/client';
import { script, toolCall } from '../test/models';

test('failed tool calls carry a structured error', async () => {
  const headers = await signIn();

  script(
    toolCall('foo', {}),
    toolCall('delegate', { tasks: [{ prompt: 'bar' }, { title: 'baz' }] }),
    toolCall('forget', { id: 'bar' }),
    fauxAssistantMessage('qux')
  );

  const id = await chat(headers, { content: 'foo' });

  expect(await toolDetails(headers, id)).toEqual([
    {
      error: {
        issues: [],
        kind: 'unavailable',
        message: 'Tool foo is not available',
      },
    },
    {
      error: {
        issues: [
          {
            keyword: 'required',
            message: 'missing',
            path: ['tasks', 0, 'title'],
          },
          {
            keyword: 'required',
            message: 'missing',
            path: ['tasks', 1, 'prompt'],
          },
        ],
        kind: 'invalid',
        message:
          'Validation failed for tool "delegate":\n  - tasks.0.title: missing\n  - tasks.1.prompt: missing\n\nReceived arguments:\n{\n  "tasks": [\n    {\n      "prompt": "bar"\n    },\n    {\n      "title": "baz"\n    }\n  ]\n}',
      },
    },
    {
      error: {
        issues: [],
        kind: 'failed',
        message: 'No memory has the id bar.',
      },
    },
  ]);
});
