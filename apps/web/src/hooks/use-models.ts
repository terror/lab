import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useConnection } from "@/hooks/use-connection";
import { useLabClient } from "@/hooks/use-lab-client";
import { queryKeys } from "@/lib/query-keys";
import { unwrap } from "@/lib/unwrap";

export function useModels(enabled = true) {
  const client = useLabClient();

  const connection = useConnection();
  const connected = connection.status === "connected";

  const queries = useQueryClient();

  const load = async (refresh: boolean, signal: AbortSignal) =>
    unwrap(await client.listModels({ refresh }, signal));

  const options = queryOptions({
    queryKey: queryKeys.models,
    queryFn: ({ signal }) => load(false, signal),
    networkMode: "always",
    retry: false,
    staleTime: 60_000,
  });

  const query = useQuery({
    ...options,
    enabled: connected && enabled,
  });

  useEffect(() => {
    if (!connected) {
      void queries.cancelQueries({ queryKey: queryKeys.models });
    }
  }, [connected, queries]);

  return {
    ...query,
    connected,
    stale: !connected || query.data === undefined,
    refresh: async () => {
      await queries.cancelQueries({ queryKey: options.queryKey });

      if (client.connection.getSnapshot().status === "connected") {
        await queries
          .query({
            ...options,
            queryFn: ({ signal }) => load(true, signal),
            staleTime: 0,
          })
          .catch(() => undefined);
      }
    },
  };
}
