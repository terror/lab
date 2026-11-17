import { SANDBOX_OUTPUT_LENGTH, type SandboxAccess } from '@lab/harness';
import { Sandbox } from '@vercel/sandbox';
import { Writable } from 'node:stream';

import { env } from './env';
import { owners } from './records';

export type SandboxProvider = {
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

  return {
    run: async (computer, { command, cwd, onOutput, signal, timeoutMs }) => {
      const sandbox = await Sandbox.getOrCreate({
        ...credentials,
        name: computer,
        timeout: IDLE_TIMEOUT_MS,
      });

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

export const sandboxAccess: SandboxAccess = {
  available: () => selected.provider !== undefined,
  exec: async (conversationId, { command, onOutput, signal, timeoutMs }) => {
    const { provider } = selected;

    if (!provider) {
      throw new Error("The user's computer isn't set up.");
    }

    const ownerId = (await owners([conversationId])).get(conversationId);

    if (!ownerId) {
      throw new Error('This chat has no owner.');
    }

    const started = Date.now();

    const chunks: string[] = [];

    const { exitCode } = await provider.run(computerName(ownerId), {
      command,
      cwd: `chats/${conversationId}`,
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
};
