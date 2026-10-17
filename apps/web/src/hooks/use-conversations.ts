import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useConnection } from "@/hooks/use-connection";
import { useLabClient } from "@/hooks/use-lab-client";
import { queryKeys } from "@/lib/query-keys";
import { unwrap } from "@/lib/utils";

export function useConversations() {
  const client = useLabClient();

  const connection = useConnection();
  const connected = connection.status === "connected";

  const queries = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: queryKeys.conversations,
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await client.listConversations(
          { limit: 50, ...(pageParam === "" ? {} : { cursor: pageParam }) },
          signal,
        ),
      ),
    initialPageParam: "",
    getNextPageParam: (page) => page.next,
    select: ({ pages }) => pages.flatMap(({ items }) => items),
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
    stale: !connected || query.isError || query.isRefetching,
    refresh: async () => {
      await queries.cancelQueries({ queryKey: queryKeys.conversations });

      if (client.connection.getSnapshot().status === "connected") {
        await query.refetch();
      }
    },
  };
}
