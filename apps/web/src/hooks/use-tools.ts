import { useQuery } from "@tanstack/react-query";
import { useConnection } from "@/hooks/use-connection";
import { useLabClient } from "@/hooks/use-lab-client";
import { queryKeys } from "@/lib/query-keys";
import { unwrap } from "@/lib/utils";

export function useTools() {
  const client = useLabClient();

  const connection = useConnection();
  const connected = connection.status === "connected";

  const query = useQuery({
    queryKey: queryKeys.tools,
    queryFn: async ({ signal }) => unwrap(await client.listTools(signal)),
    enabled: connected,
    networkMode: "always",
    retry: false,
  });

  return {
    ...query,
    stale:
      !connected ||
      query.data === undefined ||
      query.isError ||
      query.isRefetching,
  };
}
