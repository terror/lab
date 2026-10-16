import { useSyncExternalStore } from "react";
import { useLabClient } from "@/hooks/use-lab-client";

export function useOutbox() {
  const { outbox } = useLabClient();
  return useSyncExternalStore(outbox.subscribe, outbox.getSnapshot);
}
