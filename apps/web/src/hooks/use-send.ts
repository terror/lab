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
      : operation.conversationId === conversationId,
  );

  useEffect(() => {
    if (conversationId !== undefined && operation?.target === "new") {
      outbox.acknowledge(operation.input.requestId);
    }
  }, [conversationId, operation, outbox]);

  return {
    operation,
    error: snapshot.error,
    start: outbox.start,
    retry: outbox.retry,
    acknowledge: outbox.acknowledge,
  };
}
