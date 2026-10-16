import type { LabClient } from "@lab/client";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useEffect } from "react";
import { queryKeys } from "@/lib/query-keys";

export const LabContext = createContext<LabClient | undefined>(undefined);

export function LabProvider({
  client,
  children,
}: {
  client: LabClient;
  children: ReactNode;
}) {
  const queries = useQueryClient();

  useEffect(() => client.connect(), [client]);

  useEffect(() => {
    const update = async () => {
      await queries.cancelQueries({ queryKey: queryKeys.conversations });
      await queries.invalidateQueries({ queryKey: queryKeys.conversations });
    };

    const unsubscribe = client.subscribeConversations(() => void update());

    void update();

    return unsubscribe;
  }, [client, queries]);

  return <LabContext value={client}>{children}</LabContext>;
}
