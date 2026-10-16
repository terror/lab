import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useConnection } from "@/hooks/use-connection";
import { useLabClient } from "@/hooks/use-lab-client";
import { queryKeys } from "@/lib/query-keys";

export function useConversations() {
  const client = useLabClient();

  const connection = useConnection();
  const connected = connection.status === "connected";

  const queries = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: queryKeys.conversations,
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
      void queries.cancelQueries({ queryKey: queryKeys.conversations });
    }
  }, [connected, queries]);

  return {
    ...query,
    items: query.data?.pages.flatMap((page) => page.items),
    stale: !connected || query.isError || query.isRefetching,
    refresh: async () => {
      await queries.cancelQueries({ queryKey: queryKeys.conversations });

      if (client.connection.getSnapshot().status === "connected") {
        await query.refetch();
      }
    },
  };
}
