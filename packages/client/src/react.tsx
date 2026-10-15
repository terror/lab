import type { ConversationId } from "@lab/contracts";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { LabClient } from "./client";

const LabContext = createContext<LabClient | undefined>(undefined);

export function LabProvider({
  client,
  children,
}: {
  client: LabClient;
  children: ReactNode;
}) {
  useEffect(() => client.connect(), [client]);

  return <LabContext value={client}>{children}</LabContext>;
}

export function useLabClient() {
  const client = useContext(LabContext);

  if (client === undefined) {
    throw new Error("Lab hooks require a LabProvider.");
  }

  return client;
}

export function useConnection() {
  const { connection } = useLabClient();
  return useSyncExternalStore(connection.subscribe, connection.getSnapshot);
}

export function usePendingRequests() {
  const { pending } = useLabClient();
  return useSyncExternalStore(pending.subscribe, pending.getSnapshot);
}

export function useConversation(id: ConversationId) {
  const client = useLabClient();
  const conversation = useMemo(() => client.conversation(id), [client, id]);
  const snapshot = useSyncExternalStore(
    conversation.subscribe,
    conversation.getSnapshot,
  );

  return {
    ...snapshot,
    submit: conversation.submit,
    retrySubmission: conversation.retrySubmission,
    stop: conversation.stop,
  };
}
