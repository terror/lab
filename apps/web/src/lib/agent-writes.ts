import { type ToolResource, toolWrites } from '@/components/tools/names';
import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { connectorsQueryOptions } from './connectors';
import { conversationsQueryKey } from './conversations';
import { libraryQueryKey } from './library';
import { memoryQueryOptions } from './memory';
import { invalidateAll } from './mutations';
import { preferencesQueryOptions } from './preferences';
import { projectsQueryOptions } from './projects';
import { schedulesQueryOptions } from './schedules';
import { skillsQueryOptions } from './skills';
import { trashQueryKey } from './trash';

const resourceKeys = {
  connectors: connectorsQueryOptions.queryKey,
  conversations: conversationsQueryKey,
  library: libraryQueryKey,
  memory: memoryQueryOptions.queryKey,
  preferences: preferencesQueryOptions.queryKey,
  projects: projectsQueryOptions.queryKey,
  schedules: schedulesQueryOptions.queryKey,
  skills: skillsQueryOptions.queryKey,
  trash: trashQueryKey,
} satisfies Record<ToolResource, QueryKey>;

const agentWritable = [...new Set(Object.values(toolWrites).flat())].map(
  (resource) => resourceKeys[resource]
);

export function refreshAgentWrites(queryClient: QueryClient) {
  return invalidateAll(queryClient, agentWritable);
}
