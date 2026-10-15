import {
  useConnection,
  useLabClient,
  useModels,
  usePendingRequests,
} from "@lab/client/react";
import type {
  ConversationId,
  ConversationSummary,
  ModelReference,
} from "@lab/contracts";
import { useIsMutating, useMutation } from "@tanstack/react-query";
import { AlertCircle, ArrowRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import useSessionStorageState from "use-session-storage-state";
import { ChatHeader } from "@/components/chat-header";
import { LabMark } from "@/components/lab-mark";
import { ModelPicker } from "@/components/model-picker";
import { PromptInput } from "@/components/prompt-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { modelAvailable } from "@/lib/models";

type FirstMessage = {
  content: string;
  conversation?: ConversationSummary;
};

export function CreateConversation({
  onPrepared,
  onSubmitted,
  onCreated,
}: {
  onPrepared: (conversation: ConversationSummary, content: string) => void;
  onSubmitted: (conversation: ConversationSummary, content: string) => void;
  onCreated: (conversation: ConversationSummary, error?: string) => void;
}) {
  const client = useLabClient();
  const connection = useConnection();
  const pending = usePendingRequests();
  const request = pending.requests.find((request) => request.kind === "create");
  const [savedDraft, setDraft, { isPersistent }] = useSessionStorageState(
    "lab.draft.v1.new-chat",
    { defaultValue: "" },
  );
  const [savedAttempt, setAttempt, { isPersistent: attemptIsPersistent }] =
    useSessionStorageState<FirstMessage | undefined>("lab.first-message.v1");
  const draft = typeof savedDraft === "string" ? savedDraft : "";
  const attempt = useMemo(() => firstMessage(savedAttempt), [savedAttempt]);
  const recovered = useRef<ConversationId | undefined>(undefined);
  const [selection, setSelection] = useState<ModelReference>();
  const models = useModels();
  const model = request?.input.model ?? selection ?? models.data?.defaultModel;
  const connected = connection.status === "connected";
  const starting = useIsMutating({ mutationKey: ["lab", "start-chat"] }) > 0;

  const submission = useMutation({
    mutationKey: ["lab", "submit"],
    networkMode: "always",
    retry: false,
    mutationFn: ({
      conversationId,
      content,
    }: {
      conversationId: ConversationId;
      content: string;
    }) => client.submit(conversationId, { content, whenBusy: "reject" }),
  });

  const creation = useMutation({
    mutationKey: ["lab", "start-chat"],
    networkMode: "always",
    retry: false,
    mutationFn: async () => {
      const content = request === undefined ? draft : attempt?.content;

      if (content !== undefined) {
        setAttempt({ content });
      }

      const result = await (request === undefined
        ? client.createConversation({
            title: "Untitled conversation",
            ...(model === undefined ? {} : { model }),
          })
        : client.retryCreation());

      if (!result.ok) {
        if (
          !client.pending
            .getSnapshot()
            .requests.some(({ kind }) => kind === "create")
        ) {
          setAttempt(undefined);
        }

        throw new Error(result.error.message);
      }

      const conversation = result.value;

      if (content === undefined) {
        onCreated(conversation);
        return conversation;
      }

      setAttempt({ content, conversation });
      onPrepared(conversation, content);

      const error = await submission
        .mutateAsync({ conversationId: conversation.id, content })
        .then(
          (result) => (result.ok ? undefined : result.error.message),
          (error: unknown) =>
            error instanceof Error
              ? error.message
              : "Unable to send your message.",
        );

      if (error === undefined) {
        onSubmitted(conversation, content);
      }

      setDraft((current) => (current === content ? "" : current));
      setAttempt(undefined);
      onCreated(conversation, error);

      return conversation;
    },
  });

  useEffect(() => {
    if (
      attempt?.conversation !== undefined &&
      !starting &&
      recovered.current !== attempt.conversation.id
    ) {
      const conversation = attempt.conversation;
      recovered.current = conversation.id;
      onPrepared(conversation, attempt.content);
      setDraft((current) => (current === attempt.content ? "" : current));
      setAttempt(undefined);
      onCreated(conversation);
    }
  }, [attempt, onCreated, onPrepared, setAttempt, setDraft, starting]);

  const canSubmit =
    connected &&
    !starting &&
    request === undefined &&
    attempt?.conversation === undefined &&
    !models.stale &&
    modelAvailable(models.data, model) &&
    draft.trim() !== "" &&
    draft.length <= 100_000;

  return (
    <>
      <ChatHeader title="New conversation">
        <ModelPicker
          disabled={!connected || starting || request !== undefined}
          models={models}
          onChange={(model) => {
            setSelection(model);
            creation.reset();
          }}
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
            {request !== undefined && !starting && (
              <Alert>
                <AlertCircle />
                <AlertTitle>Pick up where you left off</AlertTitle>
                <AlertDescription>
                  <p>
                    Your new chat wasn’t confirmed. Recover it to continue
                    without creating another.
                  </p>
                  <Button
                    className="mt-2"
                    disabled={!connected}
                    onClick={() => creation.mutate()}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Recover chat
                    <ArrowRight />
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            <PromptInput
              autoFocus
              canSubmit={canSubmit}
              onSubmit={() => {
                if (canSubmit) {
                  creation.mutate();
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
            {creation.error && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Couldn’t start your chat</AlertTitle>
                <AlertDescription>{creation.error.message}</AlertDescription>
              </Alert>
            )}
            {(!isPersistent || !attemptIsPersistent) && (
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

function firstMessage(value: unknown): FirstMessage | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    !("content" in value) ||
    typeof value.content !== "string" ||
    value.content.trim() === "" ||
    value.content.length > 100_000
  ) {
    return undefined;
  }

  if (!("conversation" in value) || value.conversation === undefined) {
    return { content: value.content };
  }

  const conversation = value.conversation;

  if (
    typeof conversation !== "object" ||
    conversation === null ||
    !("id" in conversation) ||
    typeof conversation.id !== "number" ||
    !Number.isSafeInteger(conversation.id) ||
    conversation.id < 1 ||
    !("title" in conversation) ||
    typeof conversation.title !== "string" ||
    !("createdAt" in conversation) ||
    typeof conversation.createdAt !== "number"
  ) {
    return undefined;
  }

  return {
    content: value.content,
    conversation: {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
    },
  };
}
