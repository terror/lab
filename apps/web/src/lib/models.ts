import { thinkingLevelSchema } from '@lab/server/schemas';
import { queryOptions, useQuery } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';
import { z } from 'zod';

import { call, client } from './client';
import { usePersistentState } from './storage';

export const modelsQueryOptions = queryOptions({
  queryKey: ['models'],
  queryFn: ({ signal }) =>
    call(client.models.$get(undefined, { init: { signal } })),
  staleTime: Infinity,
});

export type Model = InferResponseType<
  typeof client.models.$get,
  200
>['models'][number];

export type ThinkingLevel = z.infer<typeof thinkingLevelSchema>;

const modelChoiceSchema = z.object({
  id: z.string(),
  provider: z.string(),
  thinkingLevel: thinkingLevelSchema.optional(),
});

export type ModelChoice = z.infer<typeof modelChoiceSchema>;

const preferredModelSchema = modelChoiceSchema.optional();

export function usePreferredModel() {
  return usePersistentState('model', preferredModelSchema, undefined);
}

export async function setConversationModel(id: number, model: ModelChoice) {
  await call(
    client.conversations[':id'].model.$put({
      param: { id: String(id) },
      json: model,
    })
  );
}

const modelKeysSchema = z.array(
  z.object({ id: z.string(), provider: z.string() })
);

export type ModelKey = z.infer<typeof modelKeysSchema>[number];

const noModels: ModelKey[] = [];

export function useRecentModels() {
  return usePersistentState('recent-models', modelKeysSchema, noModels);
}

export function useFavoriteModels() {
  return usePersistentState('favorite-models', modelKeysSchema, noModels);
}

function preferredOrDefault(
  catalog:
    | {
        default: { id: string; provider: string } | null;
        models: { id: string; provider: string }[];
      }
    | undefined,
  preferred: ModelChoice | undefined
) {
  const available = catalog?.models.some(
    ({ id, provider }) =>
      id === preferred?.id && provider === preferred.provider
  );

  if (available) {
    return preferred;
  }

  return catalog?.default ?? undefined;
}

export function useChatModel() {
  const models = useQuery(modelsQueryOptions);

  const [model, setModel] = usePreferredModel();

  return [preferredOrDefault(models.data, model), setModel] as const;
}
