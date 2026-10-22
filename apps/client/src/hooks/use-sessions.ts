import { useAuth } from '@/hooks/use-auth';
import { draftState } from '@/hooks/use-composer';
import { resetPersistedState } from '@/hooks/use-persisted-state';
import {
  api,
  mergeSessionMetadata,
  parseResponse,
  sessionListQueryOptions,
  sessionQueryOptions,
} from '@/lib/api';
import { ApiError } from '@/lib/errors';
import { useQueryScope } from '@/providers/query-provider';
import type { SessionMetadata, SessionUpdate } from '@lab/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useSessions(workspaceId: string) {
  return useQuery({
    ...sessionListQueryOptions(workspaceId),
    refetchInterval: 30_000,
  });
}

export function useCreateSession(workspaceId: string) {
  const client = useQueryClient();
  const { signal } = useQueryScope();

  return useMutation({
    mutationFn: async (text: string) => {
      const created = await parseResponse(
        api.sessions.$post(
          {
            json: {
              workspaceId,
              title: text.replace(/\s+/g, ' ').trim().slice(0, 80),
            },
          },
          { init: { signal } }
        )
      );

      signal.throwIfAborted();

      return created;
    },
    onSuccess: () => {
      if (!signal.aborted) {
        return client.invalidateQueries({
          queryKey: ['sessions', workspaceId],
        });
      }
    },
  });
}

export function useRenameSession() {
  const client = useQueryClient();
  const { signal } = useQueryScope();

  return useMutation({
    mutationFn: ({
      sessionId,
      title,
    }: SessionUpdate & Pick<SessionMetadata, 'sessionId'>) =>
      parseResponse(
        api.sessions[':sessionId'].$patch(
          {
            param: { sessionId },
            json: { title },
          },
          { init: { signal } }
        )
      ),
    onSuccess: async (metadata) => {
      await Promise.all([
        client.cancelQueries({ queryKey: ['sessions'] }),
        client.cancelQueries({ queryKey: ['session', metadata.sessionId] }),
      ]);

      if (signal.aborted) {
        return;
      }

      client.setQueriesData<SessionMetadata[]>(
        { queryKey: ['sessions'] },
        (sessions) =>
          sessions?.map((session) =>
            session.sessionId === metadata.sessionId
              ? mergeSessionMetadata(session, metadata)
              : session
          )
      );

      client.setQueryData(
        sessionQueryOptions(metadata.sessionId).queryKey,
        (snapshot) =>
          snapshot
            ? {
                ...snapshot,
                metadata: mergeSessionMetadata(snapshot.metadata, metadata),
              }
            : snapshot
      );

      await client.invalidateQueries({ queryKey: ['sessions'] });

      if (!signal.aborted) {
        toast.success('Chat renamed');
      }
    },
  });
}

export function useDeleteSession(onDeleted: (sessionId: string) => void) {
  const client = useQueryClient();
  const { data } = useAuth();
  const { signal } = useQueryScope();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      try {
        await api.sessions[':sessionId'].$delete(
          { param: { sessionId } },
          { init: { signal } }
        );
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 404)) {
          throw error;
        }
      }

      signal.throwIfAborted();

      return sessionId;
    },
    onSuccess: async (sessionId) => {
      if (signal.aborted) {
        return;
      }

      onDeleted(sessionId);

      await Promise.all([
        client.cancelQueries({ queryKey: ['sessions'] }),
        client.cancelQueries({ queryKey: ['session', sessionId] }),
      ]);

      if (signal.aborted) {
        return;
      }

      client.setQueriesData<SessionMetadata[]>(
        { queryKey: ['sessions'] },
        (sessions) =>
          sessions?.filter((session) => session.sessionId !== sessionId)
      );

      client.removeQueries({ queryKey: ['session', sessionId] });

      if (data) {
        resetPersistedState(draftState(`${data.user.id}:${sessionId}`));
      }

      toast.success('Chat deleted');

      await client.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}
