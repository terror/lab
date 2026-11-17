import { queryOptions } from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';

import { call, client } from './client';
import { useRefreshMutation } from './mutations';

type SkillsState = InferResponseType<typeof client.skills.$get, 200>;

export type Skill = SkillsState['skills'][number];

export type SkillFields = Pick<Skill, 'description' | 'instructions' | 'name'>;

export const skillsQueryOptions = queryOptions({
  queryKey: ['skills'],
  queryFn: ({ signal }) =>
    call(client.skills.$get(undefined, { init: { signal } })),
});

export function createSkill(json: SkillFields) {
  return call(client.skills.$post({ json }));
}

export function updateSkill({ id, ...json }: SkillFields & { id: string }) {
  return call(client.skills[':id'].$patch({ json, param: { id } }));
}

export function deleteSkill(id: string) {
  return call(client.skills[':id'].$delete({ param: { id } }));
}

export function useSkillsUpdate<T>(
  mutationFn: (value: T) => Promise<SkillsState>
) {
  return useRefreshMutation(mutationFn, {
    inlineError: true,
    set: skillsQueryOptions.queryKey,
  });
}
