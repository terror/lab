import { mergeSessionSnapshot, sessionQueryOptions } from '@/lib/api';
import { sessionMessages } from '@/lib/chat-projection';
import {
  type ChatActivity,
  type ChatConnection,
  type PendingSubmission,
  chatSubmissionKey,
  chatSubmissionOptions,
  followSession,
  stopChat,
} from '@/lib/chat-session';
import { ApiError } from '@/lib/errors';
import { useQueryScope } from '@/providers/query-provider';
import {
  type SessionMetadata,
  type SessionSnapshot,
  submissionSchema,
} from '@lab/shared';
import {
  type MutationFilters,
  useMutation,
  useMutationState,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export function useChatSession(sessionId: string) {
  const client = useQueryClient();
  const { signal } = useQueryScope();
  const submission = useMutation(chatSubmissionOptions(client, signal));
  const filters: MutationFilters = {
    mutationKey: chatSubmissionKey,
    predicate: (mutation) =>
      submissionSchema.safeParse(mutation.state.variables).data?.sessionId ===
      sessionId,
  };
  const submissions = useMutationState({
    filters,
    select: (mutation) => ({
      variables: submissionSchema.safeParse(mutation.state.variables).data,
      status: mutation.state.status,
      error: mutation.state.error,
    }),
  });
  const latest = submissions.at(-1);
  const pending: PendingSubmission | null =
    latest?.status === 'error' && latest.variables
      ? {
          ...latest.variables,
          state:
            latest.error instanceof ApiError && latest.error.rejected
              ? 'rejected'
              : 'uncertain',
        }
      : null;

  const [connection, setConnection] = useState<ChatConnection>({
    status: 'idle',
  });
  const [accessError, setAccessError] = useState<ApiError | null>(null);
  const [revision, setRevision] = useState(0);
  const completedResponse = useRef<string | undefined>(undefined);

  const snapshot = useQuery({
    ...sessionQueryOptions(sessionId),
    enabled: !accessError,
    refetchInterval: (query) =>
      connection.status === 'connected'
        ? false
        : query.state.data?.unfinished
          ? 5_000
          : 15_000,
  });

  const unfinished = snapshot.data?.unfinished ?? false;
  const active = snapshot.data?.live?.run !== undefined;
  const canWrite =
    !!snapshot.data &&
    !snapshot.error &&
    !accessError &&
    snapshot.data.metadata.role !== 'viewer';
  const messages = useMemo(
    () => (snapshot.data ? sessionMessages(snapshot.data) : []),
    [snapshot.data]
  );

  const revokeAccess = useCallback(
    (error: ApiError) => {
      if (signal.aborted) {
        return;
      }

      setAccessError(error);
      void client.cancelQueries({ queryKey: ['session', sessionId] });
      void client.cancelQueries({ queryKey: ['sessions'] });
      client.removeQueries({ queryKey: ['session', sessionId] });
      client.setQueriesData<SessionMetadata[]>(
        { queryKey: ['sessions'] },
        (sessions) =>
          sessions?.filter((session) => session.sessionId !== sessionId)
      );
    },
    [client, sessionId, signal]
  );

  useEffect(() => {
    const error = snapshot.error;

    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403 || error.status === 404)
    ) {
      revokeAccess(error);
    }
  }, [revokeAccess, snapshot.error]);

  const publish = useCallback(
    (next: SessionSnapshot) => {
      const snapshot =
        client.setQueryData(
          sessionQueryOptions(sessionId).queryKey,
          (current) => mergeSessionSnapshot(current, next)
        ) ?? next;

      if (!snapshot.live?.run) {
        const last = sessionMessages(snapshot).at(-1);

        if (
          last?.role === 'assistant' &&
          last.id !== completedResponse.current
        ) {
          completedResponse.current = last.id;
          void client.invalidateQueries({ queryKey: ['sessions'] });
        }
      }

      return snapshot;
    },
    [client, sessionId]
  );

  useEffect(() => {
    if (!unfinished || accessError) {
      setConnection({ status: 'idle' });
      return;
    }

    const controller = new AbortController();
    const streamSignal = AbortSignal.any([signal, controller.signal]);

    void followSession({
      sessionId,
      signal: streamSignal,
      onSnapshot: (snapshot) =>
        streamSignal.aborted ? snapshot : publish(snapshot),
      onAccessRevoked: revokeAccess,
      onConnection: (connection) => {
        if (!streamSignal.aborted) {
          setConnection(connection);
        }
      },
    });

    return () => controller.abort();
  }, [
    accessError,
    publish,
    revision,
    revokeAccess,
    sessionId,
    signal,
    unfinished,
  ]);

  const cancellation = useMutation({
    mutationFn: () => stopChat(sessionId, signal),
    onSuccess: () => {
      if (!signal.aborted) {
        return client.invalidateQueries({ queryKey: ['session', sessionId] });
      }
    },
  });

  async function submit(text: string, requestId: string) {
    if (!canWrite || signal.aborted || client.isMutating(filters)) {
      return false;
    }

    try {
      await submission.mutateAsync({ sessionId, text, requestId });
      return !signal.aborted;
    } catch {
      return false;
    }
  }

  const activity: ChatActivity = cancellation.isPending
    ? 'stopping'
    : latest?.status === 'pending'
      ? 'submitting'
      : active
        ? 'running'
        : 'idle';

  return {
    snapshot,
    messages,
    activity,
    pending,
    connection,
    accessError,
    send: async (text: string) =>
      pending || active ? false : submit(text, crypto.randomUUID()),
    stop: () => {
      if (canWrite && !cancellation.isPending && !signal.aborted) {
        cancellation.mutate();
      }
    },
    retrySending: async () =>
      pending?.state === 'uncertain'
        ? submit(pending.text, pending.requestId)
        : false,
    recoverRejected: () => {
      if (pending?.state !== 'rejected' || signal.aborted) {
        return null;
      }

      for (const mutation of client.getMutationCache().findAll(filters)) {
        if (mutation.state.status !== 'pending') {
          client.getMutationCache().remove(mutation);
        }
      }

      return pending.text;
    },
    reconnect: () => {
      if (!signal.aborted) {
        setAccessError(null);
        setRevision((revision) => revision + 1);
        void snapshot.refetch();
      }
    },
  };
}
