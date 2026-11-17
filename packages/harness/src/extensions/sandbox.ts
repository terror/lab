import {
  type ConversationId,
  type ToolExecutionResult,
  defineExtension,
  defineTool,
  section,
} from '@earendil-works/pi-durable';
import { int, obj, opt, str } from '@earendil-works/pi-schema';

export const SANDBOX_OUTPUT_LENGTH = 20_000;

const DEFAULT_TIMEOUT_SECONDS = 120;

export type SandboxCommand = {
  command: string;
  onOutput: (chunk: string) => void;
  signal: AbortSignal | undefined;
  timeoutMs: number;
};

export type SandboxRun = {
  durationMs: number;
  exitCode: number;
  output: string;
  truncated: boolean;
};

export type SandboxAccess = {
  available(): boolean;
  exec(
    conversationId: ConversationId,
    command: SandboxCommand
  ): Promise<SandboxRun>;
};

function text(value: string) {
  return [{ text: value, type: 'text' as const }];
}

export function sandbox(access: SandboxAccess) {
  const sandboxExec = defineTool({
    name: 'sandbox_exec',
    description:
      "Run a shell command on the user's persistent Linux computer. Each chat has its own working directory, and installed packages and files persist between chats. Returns the exit code and the end of the command's output.",
    callers: ['model'],
    parameters: obj({
      command: str({
        description: 'The bash command to run.',
        maxLength: 10_000,
        minLength: 1,
      }),
      timeout: opt(
        int({
          description: `Seconds before the command is killed. Defaults to ${DEFAULT_TIMEOUT_SECONDS}.`,
          maximum: 1_800,
          minimum: 1,
        })
      ),
    }),
    execute: async (
      { command, timeout },
      api,
      context
    ): Promise<ToolExecutionResult> => {
      try {
        const run = await access.exec(api.conversationId, {
          command,
          onOutput: (chunk) => api.output(chunk),
          signal: context.abortSignal,
          timeoutMs: (timeout ?? DEFAULT_TIMEOUT_SECONDS) * 1_000,
        });

        const header = `Exit code ${run.exitCode}${run.truncated ? ` (showing the last ${SANDBOX_OUTPUT_LENGTH} characters)` : ''}`;

        return {
          details: {
            durationMs: run.durationMs,
            exitCode: run.exitCode,
            truncated: run.truncated,
          },
          isError: run.exitCode !== 0,
          output: text(run.output ? `${header}\n\n${run.output}` : header),
        };
      } catch (error) {
        return {
          isError: true,
          output: text(error instanceof Error ? error.message : String(error)),
        };
      }
    },
  });

  return defineExtension({
    name: 'lab.sandbox',
    sections: [
      section('sandbox', async () =>
        access.available()
          ? "You have a persistent Linux computer for this user. Run commands on it with sandbox_exec when a task needs code, files, or tools. Each chat starts in its own working directory; installed packages persist. Commands run without the user's credentials."
          : undefined
      ),
    ],
    tools: [sandboxExec],
  });
}
