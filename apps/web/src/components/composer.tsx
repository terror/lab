import {
  useConnection,
  type useConversation,
  usePendingRequests,
} from "@lab/client/react";
import type { ConversationId } from "@lab/contracts";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export type Draft = {
  text: string;
  isPersistent: boolean;
  set: (text: string) => void;
  clear: (text: string) => void;
};

export function Composer({
  id,
  conversation,
  draft,
  stopping,
}: {
  id: ConversationId;
  conversation: ReturnType<typeof useConversation>;
  draft: Draft;
  stopping: boolean;
}) {
  const connection = useConnection();
  const pending = usePendingRequests();

  const request = pending.requests.find(
    (request) => request.kind === "submit" && request.conversationId === id,
  );

  const submission = useMutation({
    networkMode: "always",
    retry: false,
    mutationFn: async () => {
      const content =
        request?.kind === "submit" ? request.input.content : draft.text;

      const result = await (request === undefined
        ? conversation.submit({ content, whenBusy: "reject" })
        : conversation.retrySubmission());

      if (!result.ok) {
        throw new Error(result.error.message);
      }

      draft.clear(content);

      return result.value;
    },
  });

  const connected = connection.status === "connected";

  const awaitingState =
    submission.data !== undefined &&
    !conversation.value?.submissions.some(
      ({ id }) => id === submission.data?.submissionId,
    );

  const canSend =
    connected &&
    conversation.value !== undefined &&
    !conversation.stale &&
    !conversation.value.busy &&
    conversation.value.inbox.length === 0 &&
    !stopping &&
    !submission.isPending &&
    !awaitingState &&
    request === undefined &&
    draft.text.trim() !== "" &&
    draft.text.length <= 100_000;

  return (
    <form
      className="max-h-[50svh] shrink-0 overflow-y-auto border-t bg-background"
      onSubmit={(event) => {
        event.preventDefault();

        if (canSend) {
          submission.mutate();
        }
      }}
    >
      <div className="mx-auto w-full max-w-3xl space-y-3 p-4 md:p-6">
        {request?.kind === "submit" && (
          <div className="space-y-2 rounded-md border bg-muted/40 p-3">
            <p className="text-sm" role="status">
              {submission.isPending
                ? "Confirming message admission…"
                : "Message admission is unconfirmed. Retry to check whether it was accepted."}
            </p>
            <details className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">View message</summary>
              <p className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap break-words">
                {request.input.content}
              </p>
            </details>
            <Button
              disabled={!connected || submission.isPending || stopping}
              onClick={() => submission.mutate()}
              size="sm"
              type="button"
              variant="outline"
            >
              Retry admission
            </Button>
          </div>
        )}
        <label className="text-sm font-medium" htmlFor="message">
          Message
        </label>
        <Textarea
          aria-describedby="composer-status"
          className="max-h-48 min-h-24 resize-y"
          id="message"
          maxLength={100_000}
          onChange={(event) => draft.set(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              (event.metaKey || event.ctrlKey) &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Write a message…"
          value={draft.text}
        />
        <div className="flex items-center justify-between gap-4">
          <p
            className="text-xs text-muted-foreground"
            id="composer-status"
            role="status"
          >
            {stopping
              ? "Stopping current work…"
              : submission.isPending
                ? "Waiting for admission confirmation…"
                : awaitingState
                  ? "Message accepted. Waiting for the conversation to update…"
                  : !connected || conversation.stale
                    ? "Your draft is editable. Reconnect to send it."
                    : conversation.value?.busy
                      ? "Work is running. You can prepare your next message."
                      : submission.isSuccess
                        ? "Message accepted."
                        : "Ctrl/⌘ + Enter to send. Drafts are saved in this tab."}
          </p>
          <Button disabled={!canSend} type="submit">
            {submission.isPending ? "Sending…" : "Send"}
          </Button>
        </div>
        {submission.error && (
          <p className="text-sm text-destructive" role="alert">
            {submission.error.message}
          </p>
        )}
        {!draft.isPersistent && (
          <p className="text-sm text-destructive" role="alert">
            Your draft could not be saved. Keep this tab open to retain it.
          </p>
        )}
      </div>
    </form>
  );
}
