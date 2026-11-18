import type { PlanStep, sortSchema } from '@lab/server/schemas';
import {
  infiniteQueryOptions,
  type QueryClient,
  queryOptions,
  skipToken,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { InferRequestType, InferResponseType } from 'hono/client';
import { z } from 'zod';

import type { Attachment } from './attachments';
import { call, callIfFound, client } from './client';
import type { ModelChoice } from './models';
import { useRefreshMutation } from './mutations';
import { usePreference } from './preferences';
import { removeStored, usePersistentState } from './storage';

export type ConversationSort = z.infer<typeof sortSchema>;

export function conversationTitle(title: string | null | undefined) {
  return title ?? 'Untitled chat';
}

export function useConversationSort() {
  return usePreference('chatSort');
}

export const conversationsQueryKey = ['conversations'];

export type ChatScope =
  | { filter: 'all' }
  | { filter: 'recent' }
  | { project: number };

const recent: ChatScope = { filter: 'recent' };

const everything: ChatScope = { filter: 'all' };

function scopeQuery(scope: ChatScope) {
  return 'project' in scope
    ? { filter: 'all' as const, project: String(scope.project) }
    : { filter: scope.filter };
}

function conversationsQueryOptions(scope: ChatScope, sort: ConversationSort) {
  return infiniteQueryOptions({
    queryKey: [...conversationsQueryKey, scope, sort],
    queryFn: ({ pageParam, signal }) =>
      call(
        client.conversations.$get(
          { query: { cursor: pageParam, ...scopeQuery(scope), sort } },
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

function loadSummary(id: number, signal: AbortSignal) {
  return callIfFound(
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
    retry: false,
  });
}

export function useUnreadChats() {
  return useQuery({
    queryKey: [...conversationsQueryKey, 'unread'],
    queryFn: ({ signal }) =>
      call(client.conversations.unread.$get(undefined, { init: { signal } })),
    refetchInterval: ({ state }) => (state.data?.running ? 2_000 : 30_000),
  });
}

export function useConversations(scope = recent) {
  const [sort] = useConversationSort();

  return useInfiniteQuery(conversationsQueryOptions(scope, sort));
}

export function useLatestChats() {
  return useInfiniteQuery({
    ...conversationsQueryOptions(everything, 'activity'),
    refetchInterval: false,
  });
}

async function createConversation(
  content: string,
  attachments: Attachment[],
  model: ModelChoice | undefined,
  projectId?: number
) {
  const { id } = await call(
    client.conversations.$post({
      json: {
        attachments,
        content,
        model: model && { id: model.id, provider: model.provider },
        projectId,
        thinkingLevel: model?.thinkingLevel,
      },
    })
  );

  return id;
}

export const startChatKey = [...conversationsQueryKey, 'start'];

export function useStartChat({
  inlineError = true,
  projectId,
}: {
  inlineError?: boolean;
  projectId?: number;
} = {}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    meta: { inlineError },
    mutationKey: startChatKey,
    mutationFn: ({
      attachments,
      content,
      model,
    }: {
      attachments: Attachment[];
      content: string;
      model: ModelChoice | undefined;
    }) => createConversation(content, attachments, model, projectId),
    onSuccess: async (id) => {
      await navigate({ params: { id }, to: '/c/$id' });
      await queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
    },
  });
}

export type Fork = InferResponseType<
  (typeof client.conversations)[':id']['$get'],
  200
>['forks'][number];

export type BranchRequest = InferRequestType<
  (typeof client.conversations)[':id']['branches']['$post']
>['json'];

export function useBranch(id: number) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (json: BranchRequest) => {
      const branch = await call(
        client.conversations[':id'].branches.$post({
          json,
          param: { id: String(id) },
        })
      );

      return branch.id;
    },
    onSuccess: async (branch) => {
      await navigate({ params: { id: branch }, to: '/c/$id' });
      await queryClient.invalidateQueries({ queryKey: conversationsQueryKey });
    },
  });
}

export async function updateConversation(
  id: number,
  json: { pinned?: boolean; projectId?: number | null; title?: string }
) {
  await call(
    client.conversations[':id'].$patch({ param: { id: String(id) }, json })
  );
}

function listQueryOptions(filter: 'pinned', sort: ConversationSort) {
  return queryOptions({
    queryKey: [...conversationsQueryKey, filter, sort],
    queryFn: async ({ signal }) => {
      const { conversations } = await call(
        client.conversations.$get(
          { query: { filter, limit: '100', sort } },
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
  const [sort] = useConversationSort();

  return useQuery(listQueryOptions('pinned', sort));
}

export function useAnswer<T extends string>(
  id: number | undefined,
  callId: string
) {
  return useRefreshMutation(
    async (answer: T) => {
      await call(
        client.conversations[':id'].answers.$post({
          json: { answer, callId },
          param: { id: String(id ?? 0) },
        })
      );
    },
    { inlineError: true, invalidate: [conversationsQueryKey] }
  );
}

export async function editPlan(id: number, steps: PlanStep[]) {
  await call(
    client.conversations[':id'].plan.$put({
      json: { steps },
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

type DraftId = number | 'new' | 'scheduled' | `project:${number}`;

function draftKey(id: DraftId) {
  return `draft:${id}`;
}

export function clearDraft(id: number) {
  removeStored(draftKey(id));
}

export function useDraft(id: DraftId) {
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

export async function readConversation(id: number) {
  await call(
    client.conversations[':id'].read.$post({ param: { id: String(id) } })
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

export async function prefetchSidebar(
  queryClient: QueryClient,
  sort: ConversationSort
) {
  await Promise.allSettled([
    queryClient.infiniteQuery(conversationsQueryOptions(recent, sort)),
    queryClient.query(listQueryOptions('pinned', sort)),
  ]);
}
