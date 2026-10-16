import {
  useConnection,
  type useConversation,
  useSend,
} from "@lab/client/react";
import type { ConversationId } from "@lab/wire";
import { PromptInput } from "@/components/prompt-input";
import { SendFeedback } from "@/components/send-feedback";

export type Draft = {
  text: string;
  isPersistent: boolean;
  set: (text: string) => void;
};

export function Composer({
  id,
  conversation,
  draft,
  stopping,
  changingModel,
  onStop,
  canStop,
}: {
  id: ConversationId;
  conversation: ReturnType<typeof useConversation>;
  draft: Draft;
  stopping: boolean;
  changingModel: boolean;
  onStop: () => void;
  canStop: boolean;
}) {
  const connection = useConnection();
  const send = useSend(id);
  const { operation } = send;
  const connected = connection.status === "connected";
  const sending =
    operation?.phase === "creating" || operation?.phase === "submitting";
  const awaitingState = operation?.phase === "awaiting-observation";
  const unresolved = operation !== undefined && operation.phase !== "complete";

  const canSend =
    connected &&
    conversation.value !== undefined &&
    !conversation.stale &&
    !conversation.value.busy &&
    conversation.value.inbox.length === 0 &&
    !stopping &&
    !changingModel &&
    !unresolved &&
    draft.text.trim() !== "" &&
    draft.text.length <= 100_000;

  const status = stopping
    ? "Stopping response…"
    : changingModel
      ? "Switching model…"
      : sending
        ? "Sending message…"
        : awaitingState
          ? "Updating conversation…"
          : !connected || conversation.stale
            ? "Reconnecting… You can keep editing your draft."
            : conversation.value?.busy ||
                (conversation.value?.inbox.length ?? 0) > 0
              ? "You can draft your next message while lab works."
              : undefined;

  return (
    <div className="shrink-0 px-4 pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
      <div className="mx-auto w-full max-w-3xl space-y-3">
        <SendFeedback
          canEdit={draft.text === ""}
          disabled={!connected || stopping || changingModel}
          onEdit={draft.set}
          send={send}
        />
        <PromptInput
          autoFocus
          canStop={canStop}
          canSubmit={canSend}
          onStop={onStop}
          onSubmit={() => {
            if (canSend) {
              const operation = send.start({
                conversationId: id,
                content: draft.text,
                whenBusy: "reject",
              });

              if (operation !== undefined) {
                draft.set("");
              }
            }
          }}
          onValueChange={draft.set}
          status={status}
          stopping={stopping}
          submitting={sending}
          value={draft.text}
          working={
            conversation.value?.busy ||
            (conversation.value?.inbox.length ?? 0) > 0
          }
        />
        {!draft.isPersistent && (
          <p className="text-sm text-destructive" role="alert">
            Your draft could not be saved. Keep this tab open to retain it.
          </p>
        )}
      </div>
    </div>
  );
}
