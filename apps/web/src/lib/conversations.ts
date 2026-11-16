import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { type Op, applyImmutable } from '@earendil-works/chord/delta';
import {
  type ConversationView,
  type Cursor,
  type EntryRecord,
  type EntryQuery,
  type Page,
  type TranscriptItem,
  type TranscriptView,
  ConversationTranscript,
} from '@earendil-works/pi-durable';
import { infiniteQueryOptions } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Attachment } from './attachments';
import { call, client } from './client';
import type { ModelChoice } from './models';

export const conversationsQueryOptions = infiniteQueryOptions({
  queryKey: ['conversations'],
  queryFn: ({ pageParam, signal }) =>
    call(
      client.conversations.$get(
        { query: { cursor: pageParam?.toString() } },
        { init: { signal } }
      )
    ),
  initialPageParam: undefined as number | undefined,
  getNextPageParam: ({ next }) => next ?? undefined,
  select: ({ pages }) => pages.flatMap(({ conversations }) => conversations),
});

export async function createConversation(
  content: string,
  attachments: Attachment[],
  model: ModelChoice | undefined
) {
  const { id } = await call(
    client.conversations.$post({
      json: {
        attachments,
        content,
        model: model?.id,
        thinkingLevel: model?.thinkingLevel,
      },
    })
  );

  return id;
}

export async function renameConversation(id: number, title: string) {
  await call(
    client.conversations[':id'].$patch({
      param: { id: String(id) },
      json: { title },
    })
  );
}

export async function deleteConversation(id: number) {
  await call(
    client.conversations[':id'].$delete({ param: { id: String(id) } })
  );
}

export async function sendMessage(
  id: number,
  content: string,
  attachments: Attachment[]
) {
  await call(
    client.conversations[':id'].messages.$post({
      param: { id: String(id) },
      json: { attachments, content },
    })
  );
}

export async function abortConversation(id: number) {
  await call(
    client.conversations[':id'].abort.$post({ param: { id: String(id) } })
  );
}

export type Gap = Extract<TranscriptItem, { kind: 'gap' }>;

async function loadEntries(
  id: number,
  { maxEntryId, minEntryId, order }: Omit<EntryQuery, 'conversationId'>,
  limit: number
): Promise<Page<EntryRecord, Cursor>> {
  const url = client.conversations[':id'].entries.$url({
    param: { id: String(id) },
    query: {
      limit: String(limit),
      maxEntryId: maxEntryId?.toString(),
      minEntryId: minEntryId?.toString(),
      order,
    },
  });

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Unable to load messages: ${response.statusText}`);
  }

  return response.json();
}

export function useConversation(id: number) {
  const [view, setView] = useState<TranscriptView>();
  const transcript = useRef<ConversationTranscript>(undefined);

  useEffect(() => {
    const current = new ConversationTranscript((query, limit) =>
      loadEntries(id, query, limit)
    );

    transcript.current = current;

    const source = new EventSource(
      client.conversations[':id'].events.$url({ param: { id: String(id) } })
    );

    let base: ConversationView | undefined;

    source.addEventListener('value', (event) => {
      base = JSON.parse(event.data);
      setView(base && current.merge(base));
    });

    source.addEventListener('ops', (event) => {
      if (base) {
        base = applyImmutable(base, JSON.parse(event.data) as Op[]);
        setView(current.merge(base));
      }
    });

    return () => source.close();
  }, [id]);

  const loadEarlier = useCallback(async () => {
    if (transcript.current) {
      setView(await transcript.current.loadEarlier(BACKGROUND_CONTEXT));
    }
  }, []);

  const fillGap = useCallback(async (gap: Gap) => {
    if (transcript.current) {
      setView(await transcript.current.fillGap(gap, BACKGROUND_CONTEXT));
    }
  }, []);

  return { view, loadEarlier, fillGap };
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
