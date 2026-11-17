import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { afterEach, expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { chat, toolDetails, toolOutputs } from '../test/client';
import { script, toolCall } from '../test/models';
import { type SandboxProvider, useSandboxProvider } from './sandbox';

afterEach(() => {
  useSandboxProvider(undefined);
});

test('commands run on the user computer in the chat directory', async () => {
  const headers = await signIn();

  const runs: [string, string, string][] = [];

  const provider: SandboxProvider = {
    run: async (computer, { command, cwd, onOutput }) => {
      runs.push([computer.slice(0, 4), cwd.split('/')[0] ?? '', command]);

      onOutput('foo\n');
      onOutput('bar\n');

      return { exitCode: command === 'false' ? 1 : 0 };
    },
  };

  script(
    toolCall('sandbox_exec', { command: 'echo foo' }),
    fauxAssistantMessage('baz')
  );

  const missing = await chat(headers, { content: 'foo' });

  useSandboxProvider(provider);

  script(
    toolCall('sandbox_exec', { command: 'echo foo' }),
    toolCall('sandbox_exec', { command: 'false' }),
    fauxAssistantMessage('baz')
  );

  const id = await chat(headers, { content: 'foo' });

  const details = (await toolDetails(headers, id)).map(
    (detail) => (detail as { exitCode: number }).exitCode
  );

  expect({
    details,
    missing: await toolOutputs(headers, missing),
    outputs: await toolOutputs(headers, id),
    runs,
  }).toEqual({
    details: [0, 1],
    missing: ["The user's computer isn't set up."],
    outputs: ['Exit code 0\n\nfoo\nbar\n', 'Exit code 1\n\nfoo\nbar\n'],
    runs: [
      ['lab-', 'chats', 'echo foo'],
      ['lab-', 'chats', 'false'],
    ],
  });
});
