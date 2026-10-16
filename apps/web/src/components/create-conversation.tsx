import { useConnection, useModels, useSend } from "@lab/client/react";
import { type ModelReference, omitUndefined } from "@lab/wire";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import useSessionStorageState from "use-session-storage-state";
import { ChatHeader } from "@/components/chat-header";
import { LabMark } from "@/components/lab-mark";
import { ModelPicker } from "@/components/model-picker";
import { PromptInput } from "@/components/prompt-input";
import { SendFeedback } from "@/components/send-feedback";
import { modelAvailable } from "@/lib/models";

export function CreateConversation() {
  const connection = useConnection();
  const send = useSend();
  const { operation, acknowledge } = send;
  const navigate = useNavigate();
  const opened = useRef<string | undefined>(undefined);
  const [savedDraft, setDraft, { isPersistent }] = useSessionStorageState(
    "lab.draft.v1.new-chat",
    { defaultValue: "" },
  );
  const draft = typeof savedDraft === "string" ? savedDraft : "";
  const [selection, setSelection] = useState<ModelReference>();
  const models = useModels();
  const model =
    selection ?? operation?.creation?.model ?? models.data?.defaultModel;
  const connected = connection.status === "connected";
  const starting =
    operation?.phase === "creating" || operation?.phase === "submitting";
  const unresolved = operation !== undefined && operation.phase !== "complete";

  useEffect(() => {
    if (
      operation?.conversationId !== undefined &&
      opened.current !== operation.input.requestId
    ) {
      opened.current = operation.input.requestId;
      acknowledge(operation.input.requestId);
      void navigate(`/conversations/${operation.conversationId}`);
    }
  }, [acknowledge, navigate, operation]);

  const canSubmit =
    connected &&
    !unresolved &&
    !models.stale &&
    modelAvailable(models.data, model) &&
    draft.trim() !== "" &&
    draft.length <= 100_000;

  return (
    <>
      <ChatHeader title="New conversation">
        <ModelPicker
          disabled={!connected || unresolved}
          models={models}
          onChange={setSelection}
          value={model}
        />
      </ChatHeader>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 py-10 sm:-translate-y-6">
          <div className="space-y-6 text-center">
            <div className="flex flex-col items-center gap-5">
              <LabMark className="size-16 sm:size-20" />
              <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
                Your personal workspace
              </p>
            </div>
            <div className="space-y-5">
              <h1 className="text-4xl leading-[1.08] font-normal tracking-tight sm:text-6xl">
                What are you
                <br />
                <span className="text-primary italic">working on?</span>
              </h1>
              <p className="text-base leading-7 text-muted-foreground sm:text-lg">
                A little space to think, build, and figure things out.
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <SendFeedback
              canEdit={draft === ""}
              disabled={!connected}
              onEdit={setDraft}
              send={send}
            />
            <PromptInput
              autoFocus
              canSubmit={canSubmit}
              onSubmit={() => {
                if (canSubmit) {
                  const operation = send.start({
                    creation: omitUndefined({
                      title: "Untitled conversation",
                      model,
                    }),
                    content: draft,
                    whenBusy: "reject",
                  });

                  if (operation !== undefined) {
                    setDraft("");
                  }
                }
              }}
              onValueChange={setDraft}
              placeholder="Ask anything, or start with an idea…"
              status={
                starting
                  ? "Starting your chat…"
                  : !connected
                    ? "Reconnect to send. You can keep writing."
                    : undefined
              }
              submitting={starting}
              value={draft}
            />
            {!isPersistent && (
              <p className="px-2 text-sm text-destructive" role="alert">
                Your draft could not be saved. Keep this tab open to retain it.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
