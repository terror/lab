import { useQuery } from "@tanstack/react-query";
import { useConnection } from "@/hooks/use-connection";
import { useLabClient } from "@/hooks/use-lab-client";
import { queryKeys } from "@/lib/query-keys";

export function useTools() {
  const client = useLabClient();

  const connection = useConnection();
  const connected = connection.status === "connected";

  const query = useQuery({
    queryKey: queryKeys.tools,
    queryFn: async ({ signal }) => {
      const result = await client.listTools(signal);

      if (!result.ok) {
        throw new Error(result.error.message);
      }

      return result.value;
    },
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
