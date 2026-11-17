import { schema } from '@lab/db';
import { type NetworkMode, type SandboxAccess } from '@lab/harness';
import { APIError, type NetworkPolicy, Sandbox } from '@vercel/sandbox';
import { and, eq } from 'drizzle-orm';
import { posix } from 'node:path';
import { Writable } from 'node:stream';

import { credentials } from './credentials';
import { db } from './db';
import { env } from './env';
import { policy } from './policy';
import { requireOwner } from './records';
import { storeUpload } from './storage';
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
  network(computer: string, mode: NetworkMode): Promise<void>;
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

const registries = [
  '*.crates.io',
  '*.github.com',
  '*.githubusercontent.com',
  '*.npmjs.org',
  '*.pythonhosted.org',
  '*.ubuntu.com',
  'bun.sh',
  'crates.io',
  'files.pythonhosted.org',
  'github.com',
  'jsr.io',
  'proxy.golang.org',
  'pypi.org',
  'registry.npmjs.org',
  'registry.yarnpkg.com',
  'sum.golang.org',
];

const policies = {
  full: 'allow-all',
  none: 'deny-all',
  registries: { allow: registries },
} satisfies Record<NetworkMode, NetworkPolicy>;

type VercelCredentials = { projectId: string; teamId: string; token: string };

const desired = new Map<string, NetworkMode>();

function vercel(auth: VercelCredentials): SandboxProvider {
  const open = (computer: string) =>
    Sandbox.getOrCreate({
      ...auth,
      name: computer,
      networkPolicy: policies[desired.get(computer) ?? 'full'],
      timeout: IDLE_TIMEOUT_MS,
    });

  const find = async (computer: string) => {
    try {
      return await Sandbox.get({ ...auth, name: computer });
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
    network: async (computer, mode) => {
      desired.set(computer, mode);

      await (await find(computer))?.update({ networkPolicy: policies[mode] });
    },
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

export const sandboxProviders = [
  {
    fields: [
      { id: 'apiKey', label: 'Access token', secret: true },
      { id: 'teamId', label: 'Team ID', secret: false },
      { id: 'projectId', label: 'Project ID', secret: false },
    ],
    id: 'vercel-sandbox',
    name: 'Vercel Sandbox',
  },
];

async function configuredVercel() {
  const credential = await credentials.read('vercel-sandbox');

  const token =
    credential?.type === 'api_key' ? credential.key : env.VERCEL_TOKEN;

  const settings = credential?.type === 'api_key' ? credential.env : undefined;

  const teamId = settings?.teamId ?? env.VERCEL_TEAM_ID;

  const projectId = settings?.projectId ?? env.VERCEL_PROJECT_ID;

  if (!credential && env.LAB_SANDBOX_PROVIDER !== 'vercel') {
    return undefined;
  }

  return token && teamId && projectId
    ? vercel({ projectId, teamId, token })
    : undefined;
}

const override: { provider: SandboxProvider | undefined; set: boolean } = {
  provider: undefined,
  set: false,
};

async function activeProvider() {
  return override.set ? override.provider : configuredVercel();
}

const applied = new Map<string, NetworkMode>();

export function useSandboxProvider(provider: SandboxProvider | undefined) {
  override.provider = provider;
  override.set = provider !== undefined;
  applied.clear();
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

async function applyNetwork(
  provider: SandboxProvider,
  computer: string,
  mode: NetworkMode
) {
  if (applied.get(computer) !== mode) {
    await provider.network(computer, mode);
    applied.set(computer, mode);
  }
}

async function providerFor(ownerId: string) {
  return (await policy(ownerId)).computer ? activeProvider() : undefined;
}

async function computerFor(
  readNetwork: (ownerId: string) => Promise<NetworkMode>,
  conversationId: number
): Promise<Computer> {
  const ownerId = await requireOwner(conversationId);

  const provider = await providerFor(ownerId);

  if (!provider) {
    throw new Error("The user's computer isn't set up.");
  }

  const name = computerName(ownerId);

  await applyNetwork(provider, name, await readNetwork(ownerId));

  return { chat: `chats/${conversationId}`, name, ownerId, provider };
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

export function createSandboxAccess(
  readNetwork: (ownerId: string) => Promise<NetworkMode>
): SandboxAccess {
  const computerOf = (conversationId: number) =>
    computerFor(readNetwork, conversationId);

  return {
    available: async (conversationId) =>
      (await providerFor(await requireOwner(conversationId))) !== undefined,
    exec: async (conversationId, { command, onOutput, signal, timeoutMs }) => {
      const computer = await computerOf(conversationId);

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

      return { durationMs: Date.now() - started, exitCode, output };
    },
    list: async (conversationId, path) => {
      const computer = await computerOf(conversationId);

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
      const computer = await computerOf(conversationId);

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
      const computer = await computerOf(conversationId);

      const content = await computer.provider.read(
        computer.name,
        resolvePath(computer, path)
      );

      if (!content) {
        throw new Error(`No file at ${path}.`);
      }

      const fileName = name ?? posix.basename(path);

      const type = mimeType(fileName);

      const uploadId = await storeUpload(computer.ownerId, {
        content,
        mimeType: type,
      });

      return {
        mimeType: type,
        name: fileName,
        size: content.byteLength,
        uploadId,
      };
    },
    upload: async (conversationId, libraryId, path) => {
      const computer = await computerOf(conversationId);

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

      return {
        path: shownPath(computer, target),
        size: file.content.byteLength,
      };
    },
    write: async (conversationId, path, content) => {
      const computer = await computerOf(conversationId);

      const target = resolvePath(computer, path);

      const bytes = new TextEncoder().encode(content);

      await computer.provider.write(computer.name, target, bytes);

      return { path: shownPath(computer, target), size: bytes.byteLength };
    },
  };
}

export async function inspectComputer(ownerId: string) {
  const provider = await providerFor(ownerId);

  return {
    computer: provider
      ? ((await provider.inspect(computerName(ownerId))) ?? null)
      : null,
    provider: provider?.label ?? null,
  };
}

export async function applyComputerNetwork(ownerId: string, mode: NetworkMode) {
  const provider = await providerFor(ownerId);

  if (provider) {
    await applyNetwork(provider, computerName(ownerId), mode);
  }
}

async function requireProvider(ownerId: string) {
  const provider = await providerFor(ownerId);

  if (!provider) {
    throw new Error("The user's computer isn't set up.");
  }

  return provider;
}

export async function stopComputer(ownerId: string) {
  await (await requireProvider(ownerId)).stop(computerName(ownerId));
}

export async function resetComputer(ownerId: string) {
  await (await requireProvider(ownerId)).destroy(computerName(ownerId));
}

export async function removeChatFolder(
  ownerId: string,
  conversationId: number
) {
  await (
    await providerFor(ownerId)
  )?.remove(computerName(ownerId), `chats/${conversationId}`);
}
