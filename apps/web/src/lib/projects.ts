import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { InferResponseType } from 'hono/client';

import { call, client } from './client';

export type Project = InferResponseType<
  typeof client.projects.$get,
  200
>['projects'][number];

export const projectsQueryOptions = queryOptions({
  queryKey: ['projects'],
  queryFn: ({ signal }) =>
    call(client.projects.$get(undefined, { init: { signal } })),
});

export function useProjects() {
  return useQuery(projectsQueryOptions);
}

export function useProject(id: number) {
  return useQuery({
    ...projectsQueryOptions,
    select: ({ projects }) => projects.find((project) => project.id === id),
  });
}

export async function createProject(name: string) {
  const { project } = await call(client.projects.$post({ json: { name } }));

  return project;
}

export async function updateProject({
  id,
  ...json
}: Pick<Project, 'id'> & Partial<Pick<Project, 'instructions' | 'name'>>) {
  const { project } = await call(
    client.projects[':id'].$patch({ json, param: { id: String(id) } })
  );

  return project;
}

export function useProjectSave<T>(mutationFn: (value: T) => Promise<Project>) {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { inlineError: true },
    mutationFn,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: projectsQueryOptions.queryKey,
      }),
  });
}
