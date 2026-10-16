import type { ConversationId } from "@lab/wire";
import { useMemo, useSyncExternalStore } from "react";
import { useLabClient } from "@/hooks/use-lab-client";

export function useConversation(id: ConversationId) {
  const client = useLabClient();

  const conversation = useMemo(() => client.conversation(id), [client, id]);

  const snapshot = useSyncExternalStore(
    conversation.subscribe,
    conversation.getSnapshot,
  );

  return {
    ...snapshot,
    stop: conversation.stop,
    setModel: conversation.setModel,
    setTools: conversation.setTools,
  };
}
