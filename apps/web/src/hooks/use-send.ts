import type { ConversationId } from "@lab/wire";
import { useEffect } from "react";
import { useLabClient } from "@/hooks/use-lab-client";
import { useOutbox } from "@/hooks/use-outbox";

export function useSend(conversationId?: ConversationId) {
  const { outbox } = useLabClient();

  const snapshot = useOutbox();

  const operation = snapshot.operations.find((operation) =>
    conversationId === undefined
      ? operation.target === "new"
      : operation.target === conversationId ||
        (operation.phase === "complete" &&
          operation.conversationId === conversationId),
  );

  useEffect(() => {
    if (conversationId !== undefined && operation?.phase === "complete") {
      outbox.acknowledge(operation.requestId);
    }
  }, [conversationId, operation, outbox]);

  return {
    operation,
    error: snapshot.error,
    start: outbox.start,
    retry: outbox.retry,
  };
}
