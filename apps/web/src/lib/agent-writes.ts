import type { ToolName } from '@/components/tools/names';
import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { conversationsQueryKey } from './conversations';
import { libraryQueryKey } from './library';
import { memoryQueryOptions } from './memory';
import { preferencesQueryOptions } from './preferences';
import { projectsQueryOptions } from './projects';
import { schedulesQueryOptions } from './schedules';
import { skillsQueryOptions } from './skills';

const toolWrites = {
  artifact_create: [],
  artifact_read: [],
  artifact_update: [],
  ask_user: [],
  chat_delete: [conversationsQueryKey],
  chat_move: [conversationsQueryKey],
  chat_pin: [conversationsQueryKey],
  chat_read: [],
  chat_rename: [conversationsQueryKey],
  chat_search: [],
  codemode: [],
  forget: [memoryQueryOptions.queryKey],
  library_read: [],
  library_search: [],
  preferences_update: [preferencesQueryOptions.queryKey],
  project_create: [projectsQueryOptions.queryKey],
  project_delete: [conversationsQueryKey, projectsQueryOptions.queryKey],
  project_list: [],
  project_update: [projectsQueryOptions.queryKey],
  remember: [memoryQueryOptions.queryKey],
  sandbox_exec: [],
  sandbox_list: [],
  sandbox_read: [],
  sandbox_save: [libraryQueryKey],
  sandbox_upload: [],
  sandbox_write: [],
  schedule_create: [schedulesQueryOptions.queryKey],
  schedule_delete: [schedulesQueryOptions.queryKey],
  schedule_list: [],
  schedule_update: [schedulesQueryOptions.queryKey],
  skill_create: [skillsQueryOptions.queryKey],
  skill_delete: [skillsQueryOptions.queryKey],
  skill_read: [],
  skill_update: [skillsQueryOptions.queryKey],
  tool_output_read: [],
  trash_list: [],
  trash_purge: [conversationsQueryKey, projectsQueryOptions.queryKey],
  trash_restore: [conversationsQueryKey, projectsQueryOptions.queryKey],
  web_fetch: [],
  web_search: [],
} satisfies Record<ToolName, readonly QueryKey[]>;

const agentWritable = [...new Set<QueryKey>(Object.values(toolWrites).flat())];

export function refreshAgentWrites(queryClient: QueryClient) {
  return Promise.all(
    agentWritable.map((queryKey) => queryClient.invalidateQueries({ queryKey }))
  );
}
