import type {
  ConversationId,
  ConversationState,
  ModelReference,
} from "@lab/wire";
import { useMutation } from "@tanstack/react-query";
import { CircleAlertIcon } from "lucide-react";
import { useEffect } from "react";
import { ChatHeader } from "@/components/chat-header";
import { Composer, type Draft } from "@/components/composer";
import { ModelPicker } from "@/components/model-picker";
import { Transcript } from "@/components/transcript";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useConnection } from "@/hooks/use-connection";
import { useConversation } from "@/hooks/use-conversation";
import { useModels } from "@/hooks/use-models";
import { modelAvailable, modelKey } from "@/lib/models";
import { unwrap } from "@/lib/unwrap";

export function Conversation({
  id,
  draft,
}: {
  id: ConversationId;
  draft: Draft;
}) {
  const conversation = useConversation(id);
  const connection = useConnection();
  const models = useModels();
  const { value, stale, error } = conversation;
  const title = value?.conversation.title ?? "Conversation";
  const connected = connection.status === "connected";

  const model = useMutation({
    networkMode: "always",
    retry: false,
    mutationFn: async (model: ModelReference) =>
      unwrap(await conversation.setModel({ model })),
  });

  const stop = useMutation({
    networkMode: "always",
    retry: false,
    mutationFn: async () =>
      unwrap(await conversation.stop({ scope: "foreground" })),
  });

  const changingModel = model.isPending;
  const canChangeModel =
    connected &&
    !stale &&
    value !== undefined &&
    !changingModel &&
    !stop.isPending;
  const canStop =
    connected &&
    !stale &&
    !stop.isPending &&
    value !== undefined &&
    (value.busy || value.inbox.length > 0);
  const errors = [
    ...new Set(
      [
        model.error?.message,
        stop.error?.message,
        error?.message,
        value?.error?.message,
      ].filter((message) => message !== undefined),
    ),
  ];

  useEffect(() => {
    document.title = `${title} · lab`;
    return () => {
      document.title = "lab";
    };
  }, [title]);

  return (
    <>
      <ChatHeader title={title}>
        <ModelPicker
          disabled={!canChangeModel}
          models={models}
          onChange={(selection) => {
            if (
              canChangeModel &&
              modelAvailable(models.data, selection) &&
              modelKey(selection) !== modelKey(value?.model)
            ) {
              model.mutate(selection);
            }
          }}
          pending={changingModel}
          value={value?.model}
        />
        <span className="sr-only" role="status">
          {value === undefined ? "Loading conversation" : runStatus(value)}
        </span>
      </ChatHeader>
      {(stale || !connected) && value !== undefined && (
        <p
          className="shrink-0 bg-muted/50 px-5 py-2 text-center font-mono text-xs text-muted-foreground"
          role="status"
        >
          {connected
            ? "Updating your conversation…"
            : "Reconnecting. You can keep writing."}
        </p>
      )}
      {errors.length > 0 && (
        <div className="mx-auto w-full max-w-3xl shrink-0 px-5 pt-3">
          <Alert className="rounded-sm py-3" variant="destructive">
            <CircleAlertIcon aria-hidden="true" />
            <AlertDescription>
              {errors.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </AlertDescription>
          </Alert>
        </div>
      )}
      {value === undefined ? (
        error ? (
          <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Choose another chat to continue.
          </div>
        ) : (
          <div
            aria-label={
              connected ? "Loading conversation" : "Waiting for connection"
            }
            className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-10 overflow-hidden px-5 py-10"
            role="status"
          >
            <span className="sr-only">
              {connected
                ? "Loading your conversation…"
                : "Waiting for connection…"}
            </span>
            <Skeleton className="ml-auto h-16 w-2/3 rounded-sm" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          </div>
        )
      ) : (
        <Transcript state={value} stale={stale || !connected} />
      )}
      <Composer
        canStop={canStop}
        changingModel={changingModel}
        conversation={conversation}
        draft={draft}
        id={id}
        onStop={() => {
          if (canStop) {
            stop.mutate();
          }
        }}
        stopping={stop.isPending}
      />
    </>
  );
}

function runStatus(state: ConversationState) {
  if (state.busy) {
    return "Working";
  }

  const latest = state.latestSubmission;

  switch (latest?.status) {
    case "queued":
      return "Message queued";
    case "placed":
      return "Message received";
    case "done":
      return "Response complete";
    case "unanswered":
      return latest.reason === "aborted" || latest.reason === "reset"
        ? "Stopped"
        : "Ended without an answer";
    default:
      return "Ready";
  }
}
