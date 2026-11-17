import {
  type ConversationId,
  type ToolExecutionResult,
  defineExtension,
  defineTool,
  section,
} from '@earendil-works/pi-durable';
import { int, obj, opt, str } from '@earendil-works/pi-schema';

import { errorMessage, failure, once, text } from './results';
import { type Owner, userDoc } from './users';

export const SANDBOX_OUTPUT_LENGTH = 100_000;

export const networkModes = ['full', 'registries', 'none'] as const;

export type NetworkMode = (typeof networkModes)[number];

export const ComputerDoc = userDoc<{ network: NetworkMode }>(
  'lab.user.computer',
  () => ({ network: 'full' })
);

const networkNotes: Record<NetworkMode, string> = {
  full: 'It has full internet access.',
  none: 'It has no internet access.',
  registries:
    'Its internet access is limited to package registries such as PyPI, npm, GitHub, and crates.io.',
};

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
};

export type SandboxFile = { binary: boolean; size: number; text: string };

export type SandboxWrite = { path: string; size: number };

export type SavedFile = {
  mimeType: string;
  name: string;
  size: number;
  uploadId: string;
};

export type SandboxAccess = {
  available(): Promise<boolean>;
  exec(
    conversationId: ConversationId,
    command: SandboxCommand
  ): Promise<SandboxRun>;
  list(conversationId: ConversationId, path: string): Promise<string>;
  read(
    conversationId: ConversationId,
    path: string
  ): Promise<SandboxFile | undefined>;
  save(
    conversationId: ConversationId,
    path: string,
    name: string | undefined
  ): Promise<SavedFile>;
  upload(
    conversationId: ConversationId,
    libraryId: number,
    path: string | undefined
  ): Promise<SandboxWrite>;
  write(
    conversationId: ConversationId,
    path: string,
    content: string
  ): Promise<SandboxWrite>;
};

function page(content: string, offset: number) {
  const end = Math.min(content.length, offset + SANDBOX_OUTPUT_LENGTH);

  const more =
    end < content.length
      ? `\n\n[Showing characters ${offset}–${end} of ${content.length}. Call sandbox_read with offset ${end} to continue.]`
      : `\n\n[End of file at character ${content.length}.]`;

  return `${content.slice(offset, end)}${more}`;
}

const path = str({
  description:
    "A path on the computer, relative to this chat's working directory unless it starts with /.",
  maxLength: 1_000,
  minLength: 1,
});

export function sandbox(access: SandboxAccess, owner: Owner) {
  const sandboxExec = defineTool({
    name: 'sandbox_exec',
    description:
      "Run a shell command on the user's persistent Linux computer. Each chat has its own working directory, and installed packages and files persist between chats. Returns the exit code and the command's output.",
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

        const header = `Exit code ${run.exitCode}`;

        return {
          details: {
            durationMs: run.durationMs,
            exitCode: run.exitCode,
          },
          isError: run.exitCode !== 0,
          output: text(run.output ? `${header}\n\n${run.output}` : header),
        };
      } catch (error) {
        return failure(errorMessage(error));
      }
    },
  });

  const sandboxRead = defineTool({
    name: 'sandbox_read',
    description:
      "Read a text file from the user's computer, in pages of characters.",
    parameters: obj({
      offset: opt(
        int({ description: 'Character offset to continue from.', minimum: 0 })
      ),
      path,
    }),
    execute: async (args, api): Promise<ToolExecutionResult> => {
      try {
        const file = await access.read(api.conversationId, args.path);

        if (!file) {
          return failure(`No file at ${args.path}.`);
        }

        if (file.binary) {
          return {
            details: { path: args.path, size: file.size },
            output: text(
              `${args.path} is a binary file of ${file.size} bytes. Save it to the library with sandbox_save to share it.`
            ),
          };
        }

        const start = Math.min(args.offset ?? 0, file.text.length);

        return {
          details: {
            end: Math.min(file.text.length, start + SANDBOX_OUTPUT_LENGTH),
            passage: file.text.slice(start, start + 600),
            path: args.path,
            start,
            total: file.text.length,
          },
          output: text(page(file.text, start)),
        };
      } catch (error) {
        return failure(errorMessage(error));
      }
    },
  });

  const sandboxWrite = defineTool({
    name: 'sandbox_write',
    description:
      "Write a text file on the user's computer, creating folders as needed and replacing any existing file.",
    parameters: obj({
      content: str({
        description: 'The full file contents.',
        maxLength: 1_000_000,
      }),
      path,
    }),
    execute: async (args, api): Promise<ToolExecutionResult> => {
      try {
        const written = await access.write(
          api.conversationId,
          args.path,
          args.content
        );

        return {
          details: written,
          output: text(`Wrote ${written.size} bytes to ${written.path}.`),
        };
      } catch (error) {
        return failure(errorMessage(error));
      }
    },
  });

  const sandboxList = defineTool({
    name: 'sandbox_list',
    description:
      "List files on the user's computer, two levels deep, with their sizes.",
    parameters: obj({
      path: opt(path),
    }),
    execute: async (args, api): Promise<ToolExecutionResult> => {
      try {
        const listing = await access.list(api.conversationId, args.path ?? '.');

        return {
          details: { path: args.path ?? '.' },
          output: text(listing || 'No files.'),
        };
      } catch (error) {
        return failure(errorMessage(error));
      }
    },
  });

  const sandboxUpload = defineTool({
    name: 'sandbox_upload',
    description:
      "Copy a file from the user's library onto the computer. Find library ids with library_search.",
    parameters: obj({
      libraryId: int({ description: 'The library file id.', minimum: 1 }),
      path: opt(path),
    }),
    execute: async (args, api): Promise<ToolExecutionResult> => {
      try {
        const written = await access.upload(
          api.conversationId,
          args.libraryId,
          args.path
        );

        return {
          details: written,
          output: text(
            `Copied library file ${args.libraryId} to ${written.path}.`
          ),
        };
      } catch (error) {
        return failure(errorMessage(error));
      }
    },
  });

  const sandboxSave = defineTool({
    name: 'sandbox_save',
    description:
      "Save a file from the computer to the user's library and show it in the chat. Use it for files the user should get, such as reports, images, or exports.",
    parameters: obj({
      name: opt(
        str({
          description:
            'The file name to show. Defaults to the file name in the path.',
          maxLength: 200,
          minLength: 1,
        })
      ),
      path,
    }),
    execute: async (args, api, context): Promise<ToolExecutionResult> => {
      try {
        const saved = await once(api, 'saved', context, () =>
          access.save(api.conversationId, args.path, args.name)
        );

        return {
          details: saved,
          output: text(
            `Saved ${saved.name} (${saved.size} bytes) to the library.`
          ),
        };
      } catch (error) {
        return failure(errorMessage(error));
      }
    },
  });

  return defineExtension({
    name: 'lab.sandbox',
    sections: [
      section('sandbox', async ({ conversationId, read }, context) =>
        (await access.available())
          ? `You have a persistent Linux computer for this user. ${networkNotes[(await read.snapshot(ComputerDoc, await owner(conversationId), context))?.network ?? 'full']} Run commands on it with sandbox_exec, manage files with sandbox_read, sandbox_write, and sandbox_list, copy library files in with sandbox_upload, and give the user files with sandbox_save. Each chat starts in its own working directory; installed packages persist. Commands run without the user's credentials.`
          : undefined
      ),
    ],
    tools: [
      sandboxExec,
      sandboxList,
      sandboxRead,
      sandboxSave,
      sandboxUpload,
      sandboxWrite,
    ],
  });
}
