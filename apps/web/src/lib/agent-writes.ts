import type { QueryClient } from '@tanstack/react-query';

import { conversationsQueryKey } from './conversations';
import { libraryQueryKey } from './library';
import { memoryQueryOptions } from './memory';
import { preferencesQueryOptions } from './preferences';
import { schedulesQueryOptions } from './schedules';
import { skillsQueryOptions } from './skills';

const agentWritable = [
  conversationsQueryKey,
  libraryQueryKey,
  memoryQueryOptions.queryKey,
  preferencesQueryOptions.queryKey,
  schedulesQueryOptions.queryKey,
  skillsQueryOptions.queryKey,
];

export function refreshAgentWrites(queryClient: QueryClient) {
  return Promise.all(
    agentWritable.map((queryKey) => queryClient.invalidateQueries({ queryKey }))
  );
}
