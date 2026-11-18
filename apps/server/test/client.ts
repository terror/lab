import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { fauxAssistantMessage } from '@earendil-works/pi-ai';
import type { ConversationId } from '@earendil-works/pi-durable';

import app from '../src/app';
import { harness } from '../src/harness';
import { flushAll } from '../src/pipelines';
import { script, toolCall } from './models';

export async function call(
  headers: Headers,
  method: string,
  path: string,
  body?: unknown
) {
  const response = await app.request(`/api${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      ...Object.fromEntries(headers),
      'content-type': 'application/json',
    },
    method,
  });

  const text = await response.text();

  return { body: text ? JSON.parse(text) : null, status: response.status };
}

export async function idle(id: number) {
  const conversation = await harness.conversation(
    id as ConversationId,
    BACKGROUND_CONTEXT
  );

  await conversation?.waitForIdle(BACKGROUND_CONTEXT);
}

export async function create(headers: Headers) {
  const { body } = await call(headers, 'POST', '/conversations', {
    content: 'foo',
  });

  await idle(body.id);

  return body.id as number;
}

export async function settle(id?: number) {
  if (id !== undefined) {
    await idle(id);
  }

  await flushAll();
}

export async function chat(headers: Headers, body: object) {
  const { body: created } = await call(headers, 'POST', '/conversations', body);

  await settle(created.id);

  return created.id as number;
}

export function artifactChat(headers: Headers) {
  script(
    toolCall('artifact_create', {
      content: '<p>foo</p>',
      id: 'bar',
      title: 'Baz',
    }),
    fauxAssistantMessage('qux')
  );

  return chat(headers, { content: 'foo' });
}

export function raw(headers: Headers, path: string) {
  return app.request(`/api${path}`, { headers }, { timeout: () => undefined });
}

type ToolResultEntry = {
  model?: {
    content: { text?: string }[];
    details?: unknown;
    role: string;
  }[];
};

async function toolResults(headers: Headers, id: number) {
  const { body } = await call(
    headers,
    'GET',
    `/conversations/${id}/entries?order=ascending`
  );

  return (body.items as ToolResultEntry[]).flatMap(({ model }) =>
    model?.[0]?.role === 'toolResult' ? [model[0]] : []
  );
}

export async function toolOutputs(headers: Headers, id: number) {
  return (await toolResults(headers, id)).map(({ content }) =>
    content.map(({ text }) => text).join('')
  );
}

export async function toolDetails(headers: Headers, id: number) {
  return (await toolResults(headers, id)).map(({ details }) => details);
}

type ToolCallEntry = {
  model?: { content: { id?: string; type: string }[]; role: string }[];
};

export async function pendingToolCall(headers: Headers, id: number) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const { body } = await call(
      headers,
      'GET',
      `/conversations/${id}/entries?order=ascending`
    );

    const found = (body.items as ToolCallEntry[])
      .flatMap(({ model }) => model?.[0]?.content ?? [])
      .find(({ type }) => type === 'toolCall')?.id;

    if (found) {
      return found;
    }

    await Bun.sleep(20);
  }

  throw new Error('No tool call');
}
