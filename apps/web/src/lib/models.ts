import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';

import { call, client } from './client';
import { usePersistentState } from './storage';

export const modelsQueryOptions = queryOptions({
  queryKey: ['models'],
  queryFn: async ({ signal }) => {
    const { models } = await call(
      client.models.$get(undefined, { init: { signal } })
    );

    return models;
  },
  staleTime: Infinity,
});

const thinkingLevelSchema = z.enum([
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
]);

export type ThinkingLevel = z.infer<typeof thinkingLevelSchema>;

const modelChoiceSchema = z.object({
  id: z.string(),
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
