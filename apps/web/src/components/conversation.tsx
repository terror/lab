import { useConnection, useConversation } from "@lab/client/react";
import type { ConversationId, ConversationState } from "@lab/contracts";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { Composer, type Draft } from "@/components/composer";
import { Transcript } from "@/components/transcript";
import { Button } from "@/components/ui/button";

export function Conversation({
  id,
  draft,
}: {
  id: ConversationId;
  draft: Draft;
}) {
  const conversation = useConversation(id);
  const connection = useConnection();

  const { value, stale, error } = conversation;

  const title = value?.conversation.title ?? "Conversation";
  const connected = connection.status === "connected";

  const stop = useMutation({
    networkMode: "always",
    retry: false,
    mutationFn: async () => {
      const result = await conversation.stop({ scope: "foreground" });

      if (!result.ok) {
        throw new Error(result.error.message);
      }

      return result.value;
    },
  });

  useEffect(() => {
    document.title = `${title} · Lab`;
    return () => {
      document.title = "Lab";
    };
  }, [title]);

  return (
    <>
      <header className="flex shrink-0 items-center justify-between gap-4 border-b px-4 py-4 md:px-6">
        <div className="min-w-0 space-y-1">
          <h1 className="truncate font-medium" title={title}>
            {title}
          </h1>
          <p className="text-xs text-muted-foreground" role="status">
            {value === undefined
              ? "Waiting for conversation…"
              : `${stale || !connected ? "Last known state: " : ""}${runStatus(value)}`}
          </p>
        </div>
        <Button
          disabled={
            !connected ||
            stale ||
            stop.isPending ||
            value === undefined ||
            (!value.busy && value.inbox.length === 0)
          }
          onClick={() => stop.mutate()}
          size="sm"
          type="button"
          variant="outline"
        >
          {stop.isPending ? "Stopping…" : "Stop"}
        </Button>
      </header>
      {(stale || !connected) && value !== undefined && (
        <p
          className="shrink-0 border-b bg-muted/40 px-4 py-3 text-sm text-muted-foreground md:px-6"
          role="status"
        >
          This transcript may be out of date. Work can continue while you are
          disconnected.
        </p>
      )}
      {(error || value?.error || stop.error) && (
        <p
          className="shrink-0 border-b px-4 py-3 text-sm text-destructive md:px-6"
          role="alert"
        >
          {error?.message ?? value?.error?.message ?? stop.error?.message}
        </p>
      )}
      {value === undefined ? (
        <div
          className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground"
          role="status"
        >
          {error
            ? "Unable to open this conversation. Choose another from the list."
            : connected
              ? "Loading conversation…"
              : "Waiting for connection…"}
        </div>
      ) : (
        <Transcript state={value} stale={stale || !connected} />
      )}
      <Composer
        conversation={conversation}
        draft={draft}
        id={id}
        stopping={stop.isPending}
      />
    </>
  );
}

function runStatus(state: ConversationState) {
  if (state.busy) {
    return "Working";
  }

  const latest = state.submissions.at(-1);

  switch (latest?.status) {
    case "queued":
      return "Message queued";
    case "placed":
      return "Message received";
    case "done":
      return "Complete";
    case "unanswered":
      return latest.reason === "aborted" || latest.reason === "reset"
        ? "Stopped"
        : "Ended without an answer";
    default:
      return "Ready";
  }
}
