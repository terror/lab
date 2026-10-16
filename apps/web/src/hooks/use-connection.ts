import { useSyncExternalStore } from "react";
import { useLabClient } from "@/hooks/use-lab-client";

export function useConnection() {
  const { connection } = useLabClient();
  return useSyncExternalStore(connection.subscribe, connection.getSnapshot);
}
