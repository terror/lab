import {
  useConnection,
  type useConversation,
  usePendingRequests,
} from "@lab/client/react";
import type { ConversationId, Result, SubmissionReceipt } from "@lab/contracts";
import { useMutation, useMutationState } from "@tanstack/react-query";
import { AlertCircle, ChevronDown } from "lucide-react";
import { useState } from "react";
import { PromptInput } from "@/components/prompt-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
  const pending = usePendingRequests();
  const [recovering, setRecovering] = useState(false);
  const initialSubmissions = useMutationState({
    filters: {
      mutationKey: ["lab", "submit"],
      predicate: ({ state }) => {
        const variables = state.variables;
        return (
          typeof variables === "object" &&
          variables !== null &&
          "conversationId" in variables &&
          variables.conversationId === id
        );
      },
    },
    select: ({ state }) => {
      const result = state.data as Result<SubmissionReceipt> | undefined;
      return {
        pending: state.status === "pending",
        receipt: result?.ok ? result.value : undefined,
      };
    },
  });
  const initialSubmission = initialSubmissions.at(-1);

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

  const receipt = submission.data ?? initialSubmission?.receipt;
  const sending = submission.isPending || initialSubmission?.pending === true;
  const awaitingState =
    receipt !== undefined &&
    !conversation.value?.submissions.some(
      ({ id }) => id === receipt.submissionId,
    );

  const canSend =
    connected &&
    conversation.value !== undefined &&
    !conversation.stale &&
    !conversation.value.busy &&
    conversation.value.inbox.length === 0 &&
    !stopping &&
    !changingModel &&
    !sending &&
    !awaitingState &&
    request === undefined &&
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
    <div className="shrink-0 border-t bg-background px-4 pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
      <div className="mx-auto w-full max-w-3xl space-y-3">
        {request?.kind === "submit" && (!sending || recovering) && (
          <Alert className="rounded-sm bg-muted/40" role="status">
            <AlertCircle />
            <AlertDescription className="w-full gap-2">
              <div className="flex w-full flex-wrap items-center justify-between gap-2">
                <p>
                  {sending
                    ? "Confirming your message…"
                    : "Your message hasn’t been confirmed yet."}
                </p>
                {!sending && (
                  <Button
                    disabled={!connected || stopping || changingModel}
                    onClick={() => {
                      setRecovering(true);
                      submission.mutate(undefined, {
                        onSettled: () => setRecovering(false),
                      });
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Check message
                  </Button>
                )}
              </div>
              <Collapsible className="w-full">
                <CollapsibleTrigger asChild>
                  <Button
                    className="h-auto p-0 text-xs text-muted-foreground"
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    View message <ChevronDown className="size-3" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap break-words text-xs">
                  {request.input.content}
                </CollapsibleContent>
              </Collapsible>
            </AlertDescription>
          </Alert>
        )}
        <PromptInput
          autoFocus
          canStop={canStop}
          canSubmit={canSend}
          onStop={onStop}
          onSubmit={() => submission.mutate()}
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
        {submission.error && (
          <Alert variant="destructive" className="rounded-sm">
            <AlertCircle />
            <AlertDescription>{submission.error.message}</AlertDescription>
          </Alert>
        )}
        {!draft.isPersistent && (
          <p className="text-sm text-destructive" role="alert">
            Your draft could not be saved. Keep this tab open to retain it.
          </p>
        )}
      </div>
    </div>
  );
}
