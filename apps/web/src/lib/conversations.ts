import { type Op, applyImmutable } from '@earendil-works/chord/delta';
import type { ConversationView } from '@earendil-works/pi-durable';
import { queryOptions } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { z } from 'zod';

const conversationsSchema = z.object({
  conversations: z.array(z.object({ id: z.number() })),
});

const createdSchema = z.object({ id: z.number() });

const errorSchema = z.object({ error: z.string() });

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, init);

  if (!response.ok) {
    const body = errorSchema.safeParse(
      await response.json().catch(() => undefined)
    );

    throw new Error(body.data?.error ?? response.statusText);
  }

  return response;
}

export const conversationsQueryOptions = queryOptions({
  queryKey: ['conversations'],
  queryFn: async ({ signal }) => {
    const response = await request('/api/conversations', { signal });

    return conversationsSchema.parse(await response.json()).conversations;
  },
});

export async function createConversation() {
  const response = await request('/api/conversations', { method: 'POST' });

  return createdSchema.parse(await response.json()).id;
}

export async function sendMessage(id: number, content: string) {
  await request(`/api/conversations/${id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
}

export async function abortConversation(id: number) {
  await request(`/api/conversations/${id}/abort`, { method: 'POST' });
}

export function useConversationView(id: number) {
  const [view, setView] = useState<ConversationView>();

  useEffect(() => {
    const source = new EventSource(`/api/conversations/${id}/events`);

    source.addEventListener('value', (event) => {
      setView(JSON.parse(event.data));
    });

    source.addEventListener('ops', (event) => {
      const ops = JSON.parse(event.data) as Op[];
      setView((current) => current && applyImmutable(current, ops));
    });

    return () => source.close();
  }, [id]);

  return view;
}

type Content = string | readonly { type: string; text?: string }[];

export function contentText(content: Content | undefined) {
  if (content === undefined) {
    return '';
  }

  if (typeof content === 'string') {
    return content;
  }

  return content
    .map((part) => (part.type === 'text' ? (part.text ?? '') : ''))
    .join('');
}
