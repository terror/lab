import type { ConversationId } from "@lab/contracts";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { LabClient } from "./client";

const LabContext = createContext<LabClient | undefined>(undefined);

export function LabProvider({
  client,
  children,
}: {
  client: LabClient;
  children: ReactNode;
}) {
  useEffect(() => client.connect(), [client]);

  return <LabContext value={client}>{children}</LabContext>;
}

export function useLabClient() {
  const client = useContext(LabContext);

  if (client === undefined) {
    throw new Error("Lab hooks require a LabProvider.");
  }

  return client;
}

export function useConnection() {
  const { connection } = useLabClient();
  return useSyncExternalStore(connection.subscribe, connection.getSnapshot);
}

export function usePendingRequests() {
  const { pending } = useLabClient();
  return useSyncExternalStore(pending.subscribe, pending.getSnapshot);
}

export function useConversations() {
  const client = useLabClient();

  const connection = useConnection();
  const connected = connection.status === "connected";

  const queries = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: ["lab", "conversations"],
    queryFn: async ({ pageParam, signal }) => {
      const result = await client.listConversations(
        { limit: 50, ...(pageParam === "" ? {} : { cursor: pageParam }) },
        signal,
      );

      if (!result.ok) {
        throw new Error(result.error.message);
      }

      return result.value;
    },
    initialPageParam: "",
    getNextPageParam: (page) => page.next,
    enabled: connected,
    networkMode: "always",
    retry: false,
  });

  useEffect(() => {
    if (!connected) {
      void queries.cancelQueries({ queryKey: ["lab", "conversations"] });
    }
  }, [connected, queries]);

  return {
    ...query,
    items: query.data?.pages.flatMap((page) => page.items),
    stale: !connected || query.isError || query.isRefetching,
    refresh: async () => {
      await queries.cancelQueries({ queryKey: ["lab", "conversations"] });

      if (client.connection.getSnapshot().status === "connected") {
        await query.refetch();
      }
    },
  };
}

export function useConversation(id: ConversationId) {
  const client = useLabClient();

  const conversation = useMemo(() => client.conversation(id), [client, id]);

  const snapshot = useSyncExternalStore(
    conversation.subscribe,
    conversation.getSnapshot,
  );

  return {
    ...snapshot,
    submit: conversation.submit,
    retrySubmission: conversation.retrySubmission,
    stop: conversation.stop,
  };
}
