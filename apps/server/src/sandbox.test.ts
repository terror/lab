import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { afterEach, expect, test } from 'bun:test';

import { signIn } from '../test/auth';
import { call, chat, toolDetails, toolOutputs } from '../test/client';
import { script, toolCall } from '../test/models';
import { type SandboxProvider, useSandboxProvider } from './sandbox';

afterEach(() => {
  useSandboxProvider(undefined);
});

test('commands run on the user computer in the chat directory', async () => {
  const headers = await signIn();

  const runs: [string, string, string][] = [];

  const provider: SandboxProvider = {
    read: async () => undefined,
    run: async (computer, { command, cwd, onOutput }) => {
      runs.push([computer.slice(0, 4), cwd.split('/')[0] ?? '', command]);

      onOutput('foo\n');
      onOutput('bar\n');

      return { exitCode: command === 'false' ? 1 : 0 };
    },
    write: async () => undefined,
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

function memoryProvider(): SandboxProvider {
  const files = new Map<string, Uint8Array>();

  return {
    read: async (_computer, path) => files.get(path),
    run: async (_computer, { command, onOutput }) => {
      if (command.startsWith('find ')) {
        onOutput(
          [...files]
            .map(
              ([path, content]) =>
                `f ${content.byteLength} ${path.split('/').slice(2).join('/')}\n`
            )
            .join('')
        );
      }

      return { exitCode: 0 };
    },
    write: async (_computer, path, content) => {
      files.set(path, content);
    },
  };
}

test('files move between the computer and the library', async () => {
  const headers = await signIn();

  useSandboxProvider(memoryProvider());

  script(
    toolCall('sandbox_write', { content: 'foo', path: 'bar.txt' }),
    toolCall('sandbox_read', { path: 'bar.txt' }),
    toolCall('sandbox_list', {}),
    toolCall('sandbox_save', { path: 'bar.txt' }),
    fauxAssistantMessage('baz')
  );

  const id = await chat(headers, { content: 'foo' });

  const { body } = await call(headers, 'GET', '/library');

  const [saved] = body.items as { id: number; name: string; preview: string }[];

  script(
    toolCall('sandbox_upload', { libraryId: saved?.id ?? 0, path: 'qux.txt' }),
    toolCall('sandbox_read', { path: 'qux.txt' }),
    fauxAssistantMessage('baz')
  );

  const copied = await chat(headers, { content: 'foo' });

  expect({
    copied: await toolOutputs(headers, copied),
    library: saved && [saved.name, saved.preview],
    outputs: await toolOutputs(headers, id),
  }).toEqual({
    copied: [
      `Copied library file ${saved?.id} to qux.txt.`,
      'foo\n\n[End of file at character 3.]',
    ],
    library: ['bar.txt', 'foo'],
    outputs: [
      'Wrote 3 bytes to bar.txt.',
      'foo\n\n[End of file at character 3.]',
      'bar.txt (3 bytes)',
      'Saved bar.txt (3 bytes) to the library.',
    ],
  });
});
