import { workspaceQueryOptions } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

export function useWorkspaces() {
  return useQuery(workspaceQueryOptions);
}
