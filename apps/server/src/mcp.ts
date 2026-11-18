import {
  BACKGROUND_CONTEXT,
  withAbortSignal,
} from '@earendil-works/chord/context';
import {
  type ConversationId,
  LiveDoc,
  type RunFailureReason,
} from '@earendil-works/pi-durable';
import { getBunServer } from '@hono/bun';
import { schema } from '@lab/db';
import { MEMORY_LENGTH } from '@lab/harness';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as Sentry from '@sentry/bun';
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { type User, auth, requireKey, requireUser } from './auth';
import { chatSummary } from './chat-actions';
import { type BunServer, createChat } from './conversations';
import { db } from './db';
import { env } from './env';
import { found } from './found';
import { harness } from './harness';
import { flushHistory } from './history';
import { chatTranscript } from './history-access';
import { readLibraryItem, searchLibrary } from './library-access';
import { checkRate } from './limits';
import { listConversations } from './listing';
import { addMemory, readMemory, removeMemory } from './memory';
import { markedSnippet } from './message-search';
import { defaultModel, modelChange } from './models';
import { searchChats } from './search';
import { keyParam, positiveId, validator } from './validator';

const PAGE_LENGTH = 40_000;

const WAIT_SECONDS = 45;

const INSTRUCTIONS =
  "Lab is the user's AI assistant. Search and read their Lab chats and library, read and update what Lab remembers about them, and hand tasks to Lab with task_run.";

type TaskState =
  | { status: 'running' }
  | { reason: RunFailureReason; status: 'failed' }
  | { answer: string; status: 'done' };

function text(value: string): CallToolResult {
  return { content: [{ text: value, type: 'text' }] };
}

function json(value: unknown) {
  return text(JSON.stringify(value));
}

function failure(message: string): CallToolResult {
  return { ...text(message), isError: true };
}

function guard<A extends unknown[]>(
  run: (...args: A) => Promise<CallToolResult>
) {
  return async (...args: A) => {
    try {
      return await run(...args);
    } catch (error) {
      if (error instanceof HTTPException) {
        return failure(error.message);
      }

      console.error(error);

      Sentry.captureException(error);

      return failure('Internal server error');
    }
  };
}

function page(content: string, offset: number, tool: string) {
  const start = Math.min(offset, content.length);

  const end = Math.min(content.length, start + PAGE_LENGTH);

  const more =
    end < content.length
      ? `\n\n[Showing characters ${start}–${end} of ${content.length}. Call ${tool} with offset ${end} to continue.]`
      : '';

  return `${content.slice(start, end)}${more}`;
}

async function lastAnswer(id: number) {
  await flushHistory();

  const table = schema.messageText;

  const [row] = await db
    .select({ text: table.text })
    .from(table)
    .where(and(eq(table.conversationId, id), eq(table.role, 'assistant')))
    .orderBy(desc(table.entryId))
    .limit(1);

  return row?.text ?? '';
}

async function taskState(
  id: number,
  seconds: number,
  signal: AbortSignal
): Promise<TaskState> {
  const conversation = found(
    await harness.conversation(id as ConversationId, BACKGROUND_CONTEXT),
    'Conversation not found'
  );

  const waiting = AbortSignal.any([
    signal,
    AbortSignal.timeout(seconds * 1000),
  ]);

  const idle = await conversation
    .waitForIdle(withAbortSignal(waiting, BACKGROUND_CONTEXT))
    .then(
      () => true,
      () => false
    );

  if (!idle) {
    return { status: 'running' };
  }

  const failed = (
    await harness.snapshot(LiveDoc, conversation.id, BACKGROUND_CONTEXT)
  )?.runFailure;

  if (failed) {
    return { reason: failed.reason, status: 'failed' };
  }

  return { answer: await lastAnswer(id), status: 'done' };
}

async function task(id: number, seconds: number, signal: AbortSignal) {
  return json({
    id,
    url: new URL(`/c/${id}`, env.LAB_ORIGIN).href,
    ...(await taskState(id, seconds, signal)),
  });
}

const offset = z.number().int().min(0).optional();

const waitSeconds = z
  .number()
  .int()
  .min(1)
  .max(WAIT_SECONDS)
  .default(WAIT_SECONDS)
  .describe(`How long to wait for an answer, up to ${WAIT_SECONDS} seconds.`);

function server(user: User) {
  const mcp = new McpServer(
    { name: 'lab', version: env.RAILWAY_GIT_COMMIT_SHA },
    { instructions: INSTRUCTIONS }
  );

  mcp.registerTool(
    'chat_list',
    {
      annotations: { readOnlyHint: true },
      description:
        "List the user's Lab chats, most recent first. Pass next as cursor to see more.",
      inputSchema: { cursor: z.string().min(1).max(2_000).optional() },
    },
    guard(async ({ cursor }) =>
      json(
        await listConversations(user, {
          cursor,
          filter: 'all',
          limit: 50,
          sort: 'activity',
        })
      )
    )
  );

  mcp.registerTool(
    'chat_search',
    {
      annotations: { readOnlyHint: true },
      description:
        "Search the user's Lab chats by title and message text. Returns chat ids to pass to chat_read.",
      inputSchema: { query: z.string().trim().min(1).max(200) },
    },
    guard(async ({ query }) =>
      json(
        (await searchChats(user.id, query)).map(({ snippet, ...chat }) => ({
          ...chat,
          snippet: snippet && markedSnippet(snippet),
        }))
      )
    )
  );

  mcp.registerTool(
    'chat_read',
    {
      annotations: { readOnlyHint: true },
      description: `Read a Lab chat by id, ${PAGE_LENGTH} characters at a time; pass offset to continue.`,
      inputSchema: { id: positiveId, offset },
    },
    guard(async ({ id, offset: start = 0 }) => {
      await flushHistory();

      const transcript = await chatTranscript(user.id, id);

      if (!transcript) {
        return failure(`No chat has the id ${id}.`);
      }

      return text(
        `${transcript.title ?? 'Untitled chat'}\n\n${page(transcript.text, start, 'chat_read')}`
      );
    })
  );

  mcp.registerTool(
    'memory_read',
    {
      annotations: { readOnlyHint: true },
      description:
        'Read what Lab remembers about the user: their custom instructions and saved memories, with ids for forget.',
    },
    guard(async () => json(await readMemory(user.id)))
  );

  mcp.registerTool(
    'remember',
    {
      annotations: { destructiveHint: false },
      description:
        'Save a short, lasting fact about the user so Lab remembers it in every chat.',
      inputSchema: { text: z.string().trim().min(1).max(MEMORY_LENGTH) },
    },
    guard(async ({ text: fact }) =>
      (await addMemory(user.id, fact))
        ? json(await readMemory(user.id))
        : failure('Memory is full')
    )
  );

  mcp.registerTool(
    'forget',
    {
      description: 'Forget one of the facts Lab remembers, by its id.',
      inputSchema: { id: z.string().min(1) },
    },
    guard(async ({ id }) =>
      (await removeMemory(user.id, id))
        ? json(await readMemory(user.id))
        : failure(`No memory has the id ${id}.`)
    )
  );

  mcp.registerTool(
    'library_search',
    {
      annotations: { readOnlyHint: true },
      description:
        'Search the files and images the user has attached in Lab chats, newest first. Returns ids to pass to library_read.',
      inputSchema: {
        kind: z.enum(['file', 'image']).optional(),
        query: z
          .string()
          .trim()
          .max(200)
          .optional()
          .describe('Words to match in file names.'),
      },
    },
    guard(async ({ kind, query }) =>
      json(await searchLibrary(user.id, { kind, search: query || undefined }))
    )
  );

  mcp.registerTool(
    'library_read',
    {
      annotations: { readOnlyHint: true },
      description: `Read a file or image from the user's Lab library by id. Text comes ${PAGE_LENGTH} characters at a time; pass offset to continue.`,
      inputSchema: { id: positiveId, offset },
    },
    guard(async ({ id, offset: start = 0 }) => {
      const item = await readLibraryItem(user.id, id);

      if (!item) {
        return failure(`No library item has the id ${id}.`);
      }

      if (item.kind === 'image') {
        return {
          content: [
            { text: item.name, type: 'text' },
            { data: item.data, mimeType: item.mimeType, type: 'image' },
          ],
        };
      }

      return text(`${item.name}\n\n${page(item.text, start, 'library_read')}`);
    })
  );

  mcp.registerTool(
    'task_run',
    {
      annotations: { openWorldHint: true },
      description:
        'Hand a task to Lab. Lab starts a new chat with the prompt, which the user can open in Lab, and waits for its answer. If the status is still running, call task_wait with the id. A task stays running while Lab waits for the user to answer a question or approve an action in the chat.',
      inputSchema: {
        prompt: z.string().trim().min(1),
        wait_seconds: waitSeconds,
      },
    },
    guard(async ({ prompt, wait_seconds }, { signal }) => {
      checkRate('messages', user);

      const model = await defaultModel();

      if (!model) {
        return failure('Add a provider in settings to start chatting');
      }

      const id = await createChat(user.id, {
        change: modelChange(model),
        draft: { attachments: [], content: prompt },
      });

      return task(id, wait_seconds, signal);
    })
  );

  mcp.registerTool(
    'task_wait',
    {
      annotations: { readOnlyHint: true },
      description:
        'Wait for a Lab chat to finish and return its latest answer. Call it again while the status is running.',
      inputSchema: { id: positiveId, wait_seconds: waitSeconds },
    },
    guard(async ({ id, wait_seconds }, { signal }) => {
      if (!(await chatSummary(user.id, id))) {
        return failure(`No chat has the id ${id}.`);
      }

      return task(id, wait_seconds, signal);
    })
  );

  return mcp;
}

const keys = schema.apikey;

const naming = validator(
  'json',
  z.object({ name: z.string().trim().min(1).max(32) })
);

const mcp = new Hono()
  .get('/keys', requireUser, async (c) =>
    c.json({
      keys: await db
        .select({
          createdAt: keys.createdAt,
          id: keys.id,
          lastRequest: keys.lastRequest,
          name: keys.name,
          start: keys.start,
        })
        .from(keys)
        .where(eq(keys.referenceId, c.get('user').id))
        .orderBy(desc(keys.createdAt)),
    })
  )
  .post('/keys', requireUser, naming, async (c) => {
    const { key } = await auth.api.createApiKey({
      body: { name: c.req.valid('json').name, userId: c.get('user').id },
    });

    return c.json({ key }, 201);
  })
  .delete('/keys/:id', requireUser, keyParam, async (c) => {
    const [revoked] = await db
      .delete(keys)
      .where(
        and(
          eq(keys.id, c.req.valid('param').id),
          eq(keys.referenceId, c.get('user').id)
        )
      )
      .returning({ id: keys.id });

    found(revoked, 'Key not found');

    return c.body(null, 204);
  })
  .post('/', requireKey, async (c) => {
    getBunServer<BunServer>(c)?.timeout(c.req.raw, 0);

    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
      sessionIdGenerator: undefined,
    });

    await server(c.get('user')).connect(transport);

    return transport.handleRequest(c.req.raw);
  })
  .all('/', () => {
    throw new HTTPException(405, { message: 'Method not allowed' });
  });

export default mcp;
