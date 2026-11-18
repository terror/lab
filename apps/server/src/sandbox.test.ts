import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import { afterEach, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { signIn, signInAdmin } from '../test/auth';
import { call, chat, toolDetails, toolOutputs } from '../test/client';
import { script, toolCall } from '../test/models';
import { env } from './env';
import { type SandboxProvider, useSandboxProvider } from './sandbox';

afterEach(() => {
  useSandboxProvider(undefined);
});

test('commands run on the user computer in the chat directory', async () => {
  const headers = await signIn();

  const runs: [string, string, string][] = [];

  const provider: SandboxProvider = {
    ...memoryProvider(),
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

test('long tool output is shown in pages the agent can keep reading', async () => {
  const headers = await signIn();

  const output = 'a\n'.repeat(70_000);

  useSandboxProvider({
    ...memoryProvider(),
    run: async (_computer, { onOutput }) => {
      onOutput(output);

      return { exitCode: 0 };
    },
  });

  script(
    toolCall('sandbox_exec', { command: 'foo' }, 'bar'),
    toolCall('tool_output_read', { call_id: 'bar', offset: 100_000 }),
    fauxAssistantMessage('baz')
  );

  const id = await chat(headers, { content: 'qux' });

  const text = `Exit code 0\n\n${output}`;

  expect(await toolOutputs(headers, id)).toEqual([
    `${text.slice(0, 100_000)}\n\n[Showing characters 0–100000 of ${text.length}. Call tool_output_read with call_id "bar" and offset 100000 to read more.]`,
    `${text.slice(100_000)}\n\n[End of output at character ${text.length}.]`,
  ]);
});

function memoryProvider(): SandboxProvider & {
  computers: Map<string, string>;
  files: Map<string, Uint8Array>;
  networks: string[];
} {
  const networks: string[] = [];

  const files = new Map<string, Uint8Array>();

  const computers = new Map<string, string>();

  return {
    computers,
    destroy: async (computer) => {
      computers.delete(computer);
      files.clear();
    },
    files,
    inspect: async (computer) => {
      const state = computers.get(computer);

      return state === 'running' || state === 'stopped'
        ? { createdAt: '2026-01-01T00:00:00.000Z', state }
        : undefined;
    },
    label: 'Foo',
    network: async (_computer, mode) => {
      networks.push(mode);
    },
    networks,
    read: async (_computer, path) => files.get(path),
    remove: async (_computer, path) => {
      for (const key of files.keys()) {
        if (key.startsWith(`${path}/`)) {
          files.delete(key);
        }
      }
    },
    run: async (computer, { command, onOutput }) => {
      computers.set(computer, 'running');

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
    stop: async (computer) => {
      computers.set(computer, 'stopped');
    },
    write: async (computer, path, content) => {
      computers.set(computer, 'running');
      files.set(path, content);
    },
  };
}

test('listed paths are not run by the shell', async () => {
  const headers = await signIn();

  const dir = await mkdtemp(join(tmpdir(), 'lab-'));

  useSandboxProvider({
    ...memoryProvider(),
    run: async (_computer, { command }) => {
      await Bun.$`bash -c ${command}`.cwd(dir).nothrow().quiet();

      return { exitCode: 0 };
    },
  });

  script(
    toolCall('sandbox_list', { path: '$(touch foo)' }),
    fauxAssistantMessage('bar')
  );

  await chat(headers, { content: 'baz' });

  expect(existsSync(join(dir, 'foo'))).toBe(false);
});

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

test('the computer can be stopped, reset, and cleaned up from the trash', async () => {
  const headers = await signIn();

  const provider = memoryProvider();

  useSandboxProvider(provider);

  script(
    toolCall('sandbox_write', { content: 'foo', path: 'bar.txt' }),
    fauxAssistantMessage('baz')
  );

  const id = await chat(headers, { content: 'foo' });

  const running = (await call(headers, 'GET', '/computer')).body;

  const network = await call(headers, 'PATCH', '/computer', {
    network: 'none',
  });

  await call(headers, 'POST', '/computer/stop');

  const stopped = (await call(headers, 'GET', '/computer')).body.computer.state;

  await call(headers, 'DELETE', `/conversations/${id}`);
  await call(headers, 'DELETE', `/trash/conversation/${id}`);
  await Bun.sleep(10);

  const files = [...provider.files.keys()];

  await call(headers, 'DELETE', '/computer');

  const reset = (await call(headers, 'GET', '/computer')).body;

  const applied = [...provider.networks];

  await call(headers, 'PATCH', '/computer', { network: 'full' });

  expect({
    applied,
    files,
    network: network.body.network,
    reset,
    running,
    stopped,
  }).toEqual({
    applied: ['full', 'none'],
    files: [],
    network: 'none',
    reset: { computer: null, network: 'none', provider: 'Foo' },
    running: {
      computer: { createdAt: '2026-01-01T00:00:00.000Z', state: 'running' },
      network: 'full',
      provider: 'Foo',
    },
    stopped: 'stopped',
  });
});

async function computerProvider(headers: Headers) {
  return (await call(headers, 'GET', '/computer')).body.provider;
}

test('only the admin gets a computer unless everyone is allowed', async () => {
  useSandboxProvider(memoryProvider());

  env.LAB_COMPUTER_USERS = 'admin';

  try {
    expect({
      admin: await computerProvider(await signInAdmin()),
      user: await computerProvider(await signIn()),
    }).toEqual({ admin: 'Foo', user: null });
  } finally {
    env.LAB_COMPUTER_USERS = 'everyone';
  }
});
