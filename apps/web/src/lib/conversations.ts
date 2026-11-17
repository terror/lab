import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { type Op, applyImmutable } from '@earendil-works/chord/delta';
import {
  type ConversationView,
  type Cursor,
  type EntryRecord,
  type EntryQuery,
  type LiveState,
  type Page,
  type TranscriptItem,
  type TranscriptView,
  ConversationTranscript,
} from '@earendil-works/pi-durable';
import { sortSchema } from '@lab/server/schemas';
import {
  infiniteQueryOptions,
  queryOptions,
  keepPreviousData,
  skipToken,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';

import type { Attachment } from './attachments';
import { call, client } from './client';
import type { ModelChoice } from './models';
import { removeStored, usePersistentState } from './storage';

export type ConversationSort = z.infer<typeof sortSchema>;

export function conversationTitle(title: string | null | undefined) {
  return title ?? 'New chat';
}

export function useConversationSort() {
  return usePersistentState('sort', sortSchema, 'activity');
}

export const conversationsQueryKey = ['conversations'];

function conversationsQueryOptions(sort: ConversationSort) {
  return infiniteQueryOptions({
    queryKey: [...conversationsQueryKey, sort],
    queryFn: ({ pageParam, signal }) =>
      call(
        client.conversations.$get(
          { query: { cursor: pageParam, filter: 'recent', sort } },
          { init: { signal } }
        )
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: ({ next }) => next ?? undefined,
    refetchInterval: ({ state }) => {
      const running = state.data?.pages.some(({ conversations }) =>
        conversations.some((conversation) => conversation.running)
      );

      return running ? 2_000 : false;
    },
    select: ({ pages }) => pages.flatMap(({ conversations }) => conversations),
  });
}

export function useConversationSearch(search: string) {
  return useQuery({
    enabled: search.length > 0,
    placeholderData: keepPreviousData,
    queryKey: [...conversationsQueryKey, 'search', search],
    queryFn: async ({ signal }) => {
      const { conversations } = await call(
        client.conversations.$get(
          { query: { limit: '20', search } },
          { init: { signal } }
        )
      );

      return conversations;
    },
  });
}

function loadSummary(id: number, signal: AbortSignal) {
  return call(
    client.conversations[':id'].$get(
      { param: { id: String(id) } },
      { init: { signal } }
    )
  );
}

export function useConversationSummary(id: number | undefined) {
  return useQuery({
    queryKey: [...conversationsQueryKey, 'summary', id],
    queryFn:
      id === undefined ? skipToken : ({ signal }) => loadSummary(id, signal),
    refetchInterval: ({ state }) => (state.data?.running ? 2_000 : false),
  });
}

export function useConversations() {
  const [sort] = useConversationSort();

  return useInfiniteQuery(conversationsQueryOptions(sort));
}

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
        model: model && { id: model.id, provider: model.provider },
        thinkingLevel: model?.thinkingLevel,
      },
    })
  );

  return id;
}

export async function updateConversation(
  id: number,
  json: { pinned?: boolean; title?: string }
) {
  await call(
    client.conversations[':id'].$patch({ param: { id: String(id) }, json })
  );
}

function listQueryOptions(filter: 'pinned') {
  return queryOptions({
    queryKey: [...conversationsQueryKey, filter],
    queryFn: async ({ signal }) => {
      const { conversations } = await call(
        client.conversations.$get(
          { query: { filter, limit: '100' } },
          { init: { signal } }
        )
      );

      return conversations;
    },
    refetchInterval: ({ state }) =>
      state.data?.some(({ running }) => running) ? 2_000 : false,
  });
}

export function usePinnedConversations() {
  return useQuery(listQueryOptions('pinned'));
}

export async function answerQuestion(
  id: number,
  json: { answer: string; callId: string }
) {
  await call(
    client.conversations[':id'].answers.$post({
      json,
      param: { id: String(id) },
    })
  );
}

export async function deleteConversation(id: number) {
  await call(
    client.conversations[':id'].$delete({ param: { id: String(id) } })
  );
}

const draftSchema = z.string();

function draftKey(id: number | 'new') {
  return `draft:${id}`;
}

export function clearDraft(id: number) {
  removeStored(draftKey(id));
}

export function useDraft(id: number | 'new') {
  return usePersistentState(draftKey(id), draftSchema, '');
}

export async function sendMessage(
  id: number,
  content: string,
  attachments: Attachment[],
  steer: boolean
) {
  await call(
    client.conversations[':id'].messages.$post({
      param: { id: String(id) },
      json: { attachments, content, steer },
    })
  );
}

export async function compactConversation(id: number) {
  await call(
    client.conversations[':id'].compact.$post({ param: { id: String(id) } })
  );
}

export async function abortConversation(id: number) {
  await call(
    client.conversations[':id'].abort.$post({ param: { id: String(id) } })
  );
}

export async function cancelSubmission(id: number, submission: number) {
  await call(
    client.conversations[':id'].submissions[':submissionId'].$delete({
      param: { id: String(id), submissionId: String(submission) },
    })
  );
}

export type Gap = Extract<TranscriptItem, { kind: 'gap' }>;

async function loadEntries(
  id: number,
  { maxEntryId, minEntryId, order }: Omit<EntryQuery, 'conversationId'>,
  limit: number
) {
  const page = await call(
    client.conversations[':id'].entries.$get({
      param: { id: String(id) },
      query: {
        limit: String(limit),
        maxEntryId: maxEntryId?.toString(),
        minEntryId: minEntryId?.toString(),
        order,
      },
    })
  );

  return page as unknown as Page<EntryRecord, Cursor>;
}

export function useConversation(id: number) {
  const [view, setView] = useState<TranscriptView>();
  const [status, setStatus] = useState<string>();
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

        if (!(base.docs['pi.live'] as LiveState | undefined)?.run) {
          setStatus(undefined);
        }
      }
    });

    source.addEventListener('status', (event) => {
      setStatus(event.data);
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

  return { view, status, loadEarlier, fillGap };
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
