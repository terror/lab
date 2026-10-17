import type { ConversationId } from "@lab/wire";
import { type PromptAction, PromptInput } from "@/components/prompt-input";
import { SendFeedback } from "@/components/send-feedback";
import { useConnection } from "@/hooks/use-connection";
import type { useConversation } from "@/hooks/use-conversation";
import { useSend } from "@/hooks/use-send";

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
  const sending = operation?.phase === "submitting";
  const unresolved = operation !== undefined && operation.phase !== "rejected";
  const working =
    conversation.value?.busy || (conversation.value?.inbox.length ?? 0) > 0;

  const canSend =
    connected &&
    !conversation.stale &&
    !working &&
    !stopping &&
    !changingModel &&
    !unresolved &&
    draft.text.trim() !== "" &&
    draft.text.length <= 100_000;

  const action = ((): PromptAction => {
    if (stopping) {
      return { type: "stopping" };
    }

    if (working) {
      return { type: "stop", disabled: !canStop, onStop };
    }

    if (sending) {
      return { type: "sending" };
    }

    return {
      type: "send",
      disabled: !canSend,
      onSubmit: () => {
        if (canSend) {
          const operation = send.start({
            target: id,
            input: {
              content: draft.text,
              whenBusy: "reject",
            },
          });

          if (operation !== undefined) {
            draft.set("");
          }
        }
      },
    };
  })();

  const status = (() => {
    if (stopping) {
      return "Stopping response…";
    }

    if (changingModel) {
      return "Switching model…";
    }

    if (sending) {
      return "Sending message…";
    }

    if (!connected || conversation.stale) {
      return "Reconnecting… You can keep editing your draft.";
    }

    if (working) {
      return "You can draft your next message while lab works.";
    }

    return undefined;
  })();

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
          action={action}
          autoFocus
          onValueChange={draft.set}
          status={status}
          value={draft.text}
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
