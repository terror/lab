import { type Op, applyImmutable } from '@earendil-works/chord/delta';
import type { ConversationView } from '@earendil-works/pi-durable';
import { queryOptions } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { call, client } from './client';

export const conversationsQueryOptions = queryOptions({
  queryKey: ['conversations'],
  queryFn: async ({ signal }) => {
    const { conversations } = await call(
      client.conversations.$get(undefined, { init: { signal } })
    );

    return conversations;
  },
});

export async function createConversation() {
  const { id } = await call(client.conversations.$post());

  return id;
}

export async function sendMessage(id: number, content: string) {
  await call(
    client.conversations[':id'].messages.$post({
      param: { id: String(id) },
      json: { content },
    })
  );
}

export async function abortConversation(id: number) {
  await call(
    client.conversations[':id'].abort.$post({ param: { id: String(id) } })
  );
}

export function useConversationView(id: number) {
  const [view, setView] = useState<ConversationView>();

  useEffect(() => {
    const source = new EventSource(
      client.conversations[':id'].events.$url({ param: { id: String(id) } })
    );

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
