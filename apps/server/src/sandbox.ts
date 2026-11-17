import { schema } from '@lab/db';
import { SANDBOX_OUTPUT_LENGTH, type SandboxAccess } from '@lab/harness';
import { APIError, Sandbox } from '@vercel/sandbox';
import { and, eq } from 'drizzle-orm';
import { posix } from 'node:path';
import { Writable } from 'node:stream';

import { db } from './db';
import { env } from './env';
import { owners } from './records';
import { decodeText } from './text';

export type ComputerState = {
  createdAt: string;
  state:
    | 'aborted'
    | 'failed'
    | 'pending'
    | 'running'
    | 'snapshotting'
    | 'stopped'
    | 'stopping';
};

export type SandboxProvider = {
  destroy(computer: string): Promise<void>;
  inspect(computer: string): Promise<ComputerState | undefined>;
  label: string;
  read(computer: string, path: string): Promise<Uint8Array | undefined>;
  run(
    computer: string,
    options: {
      command: string;
      cwd: string;
      onOutput: (chunk: string) => void;
      signal: AbortSignal | undefined;
      timeoutMs: number;
    }
  ): Promise<{ exitCode: number }>;
  remove(computer: string, path: string): Promise<void>;
  stop(computer: string): Promise<void>;
  write(computer: string, path: string, content: Uint8Array): Promise<void>;
};

const IDLE_TIMEOUT_MS = 10 * 60_000;

function vercel(): SandboxProvider | undefined {
  const { VERCEL_PROJECT_ID, VERCEL_TEAM_ID, VERCEL_TOKEN } = env;

  if (!VERCEL_PROJECT_ID || !VERCEL_TEAM_ID || !VERCEL_TOKEN) {
    return undefined;
  }

  const credentials = {
    projectId: VERCEL_PROJECT_ID,
    teamId: VERCEL_TEAM_ID,
    token: VERCEL_TOKEN,
  };

  const open = (computer: string) =>
    Sandbox.getOrCreate({
      ...credentials,
      name: computer,
      timeout: IDLE_TIMEOUT_MS,
    });

  const find = async (computer: string) => {
    try {
      return await Sandbox.get({ ...credentials, name: computer });
    } catch (error) {
      if (error instanceof APIError && error.response.status === 404) {
        return undefined;
      }

      throw error;
    }
  };

  return {
    destroy: async (computer) => {
      await (await find(computer))?.delete();
    },
    inspect: async (computer) => {
      const sandbox = await find(computer);

      return (
        sandbox && {
          createdAt: sandbox.createdAt.toISOString(),
          state: sandbox.status,
        }
      );
    },
    label: 'Vercel Sandbox',
    read: async (computer, path) => {
      const content = await (await open(computer)).readFileToBuffer({ path });

      return content ? new Uint8Array(content) : undefined;
    },
    run: async (computer, { command, cwd, onOutput, signal, timeoutMs }) => {
      const sandbox = await open(computer);

      const sink = new Writable({
        write(chunk: Buffer, _encoding, done) {
          onOutput(chunk.toString('utf8'));
          done();
        },
      });

      const finished = await sandbox.runCommand({
        args: [
          '-lc',
          `mkdir -p ${JSON.stringify(cwd)} && cd ${JSON.stringify(cwd)} && ${command}`,
        ],
        cmd: 'bash',
        signal,
        stderr: sink,
        stdout: sink,
        timeoutMs,
      });

      return { exitCode: finished.exitCode };
    },
    remove: async (computer, path) => {
      await (await find(computer))?.runCommand('rm', ['-rf', path]);
    },
    stop: async (computer) => {
      await (await find(computer))?.stop();
    },
    write: async (computer, path, content) => {
      await (await open(computer)).writeFiles([{ content, path }]);
    },
  };
}

const providers = { vercel } satisfies Record<
  string,
  () => SandboxProvider | undefined
>;

const selected: { provider: SandboxProvider | undefined } = {
  provider: env.LAB_SANDBOX_PROVIDER
    ? providers[env.LAB_SANDBOX_PROVIDER]()
    : undefined,
};

export function useSandboxProvider(provider: SandboxProvider | undefined) {
  selected.provider = provider;
}

function computerName(ownerId: string) {
  return `lab-${ownerId.toLowerCase().replaceAll(/[^a-z0-9-]/g, '-')}`;
}

const MAX_READ_BYTES = 5_000_000;

const mimeTypes: Record<string, string> = {
  csv: 'text/csv',
  gif: 'image/gif',
  html: 'text/html',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  json: 'application/json',
  md: 'text/markdown',
  pdf: 'application/pdf',
  png: 'image/png',
  svg: 'image/svg+xml',
  txt: 'text/plain',
  webp: 'image/webp',
  zip: 'application/zip',
};

function mimeType(name: string) {
  const extension = name.split('.').at(-1)?.toLowerCase() ?? '';

  return mimeTypes[extension] ?? 'application/octet-stream';
}

type Computer = {
  chat: string;
  name: string;
  ownerId: string;
  provider: SandboxProvider;
};

async function computerFor(conversationId: number): Promise<Computer> {
  const { provider } = selected;

  if (!provider) {
    throw new Error("The user's computer isn't set up.");
  }

  const ownerId = (await owners([conversationId])).get(conversationId);

  if (!ownerId) {
    throw new Error('This chat has no owner.');
  }

  return {
    chat: `chats/${conversationId}`,
    name: computerName(ownerId),
    ownerId,
    provider,
  };
}

function resolvePath({ chat }: Computer, path: string) {
  return path.startsWith('/') ? posix.normalize(path) : posix.join(chat, path);
}

function shownPath({ chat }: Computer, path: string) {
  const relative = posix.relative(chat, path);

  return relative.startsWith('..') || posix.isAbsolute(relative)
    ? path
    : relative;
}

async function libraryFile(ownerId: string, id: number) {
  const [row] = await db
    .select({
      content: schema.libraryItem.content,
      name: schema.libraryItem.name,
      original: schema.upload.content,
    })
    .from(schema.libraryItem)
    .leftJoin(schema.upload, eq(schema.upload.id, schema.libraryItem.uploadId))
    .where(
      and(
        eq(schema.libraryItem.id, id),
        eq(schema.libraryItem.ownerId, ownerId)
      )
    );

  return row && { content: row.original ?? row.content, name: row.name };
}

async function run(
  computer: Computer,
  command: string,
  options: { onOutput?: (chunk: string) => void; signal?: AbortSignal } = {}
) {
  const chunks: string[] = [];

  const { exitCode } = await computer.provider.run(computer.name, {
    command,
    cwd: computer.chat,
    onOutput: (chunk) => {
      chunks.push(chunk);
      options.onOutput?.(chunk);
    },
    signal: options.signal,
    timeoutMs: 120_000,
  });

  return { exitCode, output: chunks.join('') };
}

export const sandboxAccess: SandboxAccess = {
  available: () => selected.provider !== undefined,
  exec: async (conversationId, { command, onOutput, signal, timeoutMs }) => {
    const computer = await computerFor(conversationId);

    const started = Date.now();

    const chunks: string[] = [];

    const { exitCode } = await computer.provider.run(computer.name, {
      command,
      cwd: computer.chat,
      onOutput: (chunk) => {
        chunks.push(chunk);
        onOutput(chunk);
      },
      signal,
      timeoutMs,
    });

    const output = chunks.join('');

    return {
      durationMs: Date.now() - started,
      exitCode,
      output: output.slice(-SANDBOX_OUTPUT_LENGTH),
      truncated: output.length > SANDBOX_OUTPUT_LENGTH,
    };
  },
  list: async (conversationId, path) => {
    const computer = await computerFor(conversationId);

    const target = JSON.stringify(resolvePath(computer, path));

    const { exitCode, output } = await run(
      computer,
      `find ${target} -maxdepth 2 -not -path '*/.*' -printf '%y %s %P\\n' | sort -k3 | head -500`
    );

    if (exitCode !== 0) {
      throw new Error(`Unable to list ${path}.`);
    }

    return output
      .split('\n')
      .filter((line) => line.trim() && !line.endsWith(' '))
      .map((line) => {
        const [type, size, ...name] = line.split(' ');

        return type === 'd'
          ? `${name.join(' ')}/`
          : `${name.join(' ')} (${size} bytes)`;
      })
      .join('\n');
  },
  read: async (conversationId, path) => {
    const computer = await computerFor(conversationId);

    const content = await computer.provider.read(
      computer.name,
      resolvePath(computer, path)
    );

    if (!content) {
      return undefined;
    }

    const text =
      content.byteLength <= MAX_READ_BYTES ? decodeText(content) : undefined;

    return {
      binary: text === undefined,
      size: content.byteLength,
      text: text ?? '',
    };
  },
  save: async (conversationId, path, name) => {
    const computer = await computerFor(conversationId);

    const content = await computer.provider.read(
      computer.name,
      resolvePath(computer, path)
    );

    if (!content) {
      throw new Error(`No file at ${path}.`);
    }

    const fileName = name ?? posix.basename(path);

    const type = mimeType(fileName);

    const [created] = await db
      .insert(schema.upload)
      .values({ content, mimeType: type, ownerId: computer.ownerId })
      .returning({ id: schema.upload.id });

    if (!created) {
      throw new Error(`Unable to save ${fileName}.`);
    }

    return {
      mimeType: type,
      name: fileName,
      size: content.byteLength,
      uploadId: created.id,
    };
  },
  upload: async (conversationId, libraryId, path) => {
    const computer = await computerFor(conversationId);

    const file = await libraryFile(computer.ownerId, libraryId);

    if (!file) {
      throw new Error(`No library file has the id ${libraryId}.`);
    }

    const target = resolvePath(computer, path ?? file.name);

    await computer.provider.write(
      computer.name,
      target,
      new Uint8Array(file.content)
    );

    return { path: shownPath(computer, target), size: file.content.byteLength };
  },
  write: async (conversationId, path, content) => {
    const computer = await computerFor(conversationId);

    const target = resolvePath(computer, path);

    const bytes = new TextEncoder().encode(content);

    await computer.provider.write(computer.name, target, bytes);

    return { path: shownPath(computer, target), size: bytes.byteLength };
  },
};

export async function computerStatus(ownerId: string) {
  const { provider } = selected;

  return {
    computer: provider
      ? ((await provider.inspect(computerName(ownerId))) ?? null)
      : null,
    provider: provider?.label ?? null,
  };
}

function requireProvider() {
  const { provider } = selected;

  if (!provider) {
    throw new Error("The user's computer isn't set up.");
  }

  return provider;
}

export async function stopComputer(ownerId: string) {
  await requireProvider().stop(computerName(ownerId));
}

export async function resetComputer(ownerId: string) {
  await requireProvider().destroy(computerName(ownerId));
}

export async function removeChatFolder(
  ownerId: string,
  conversationId: number
) {
  await selected.provider?.remove(
    computerName(ownerId),
    `chats/${conversationId}`
  );
}
