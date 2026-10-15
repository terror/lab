import {
  useConnection,
  useLabClient,
  usePendingRequests,
} from "@lab/client/react";
import type { ConversationSummary } from "@lab/contracts";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import useSessionStorageState from "use-session-storage-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateConversation({
  onCreated,
}: {
  onCreated: (conversation: ConversationSummary) => void;
}) {
  const client = useLabClient();
  const connection = useConnection();

  const pending = usePendingRequests();
  const request = pending.requests.find((request) => request.kind === "create");

  const [savedTitle, setTitle, { isPersistent }] = useSessionStorageState(
    "lab.draft.v1.conversation-title",
    { defaultValue: "" },
  );
  const title = typeof savedTitle === "string" ? savedTitle : "";
  const [open, setOpen] = useState(false);

  const input = useRef<HTMLInputElement>(null);
  const connected = connection.status === "connected";

  const creation = useMutation({
    networkMode: "always",
    retry: false,
    mutationFn: async () => {
      const result = await (request === undefined
        ? client.createConversation({ title: title.trim() })
        : client.retryCreation());

      if (!result.ok) {
        throw new Error(result.error.message);
      }

      if (request === undefined || request.input.title === title.trim()) {
        setTitle((current) => (current === title ? "" : current));
      }

      return result.value;
    },
  });

  useEffect(() => {
    if (open) {
      input.current?.focus();
    }
  }, [open]);

  if (!open && request === undefined) {
    return (
      <Button
        className="w-full"
        onClick={() => setOpen(true)}
        type="button"
        variant="outline"
      >
        New conversation
      </Button>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();

        if (
          !creation.isPending &&
          connected &&
          (request !== undefined || title.trim() !== "")
        ) {
          setOpen(true);
          creation.mutate(undefined, {
            onSuccess: (conversation) => {
              setOpen(false);
              onCreated(conversation);
            },
          });
        }
      }}
    >
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="conversation-title">
          Conversation name
        </label>
        <Input
          autoComplete="off"
          disabled={creation.isPending || request !== undefined}
          id="conversation-title"
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What are you working on?"
          ref={input}
          required
          value={request?.input.title ?? title}
        />
      </div>
      {request !== undefined && !creation.isPending && (
        <p className="text-xs text-muted-foreground" role="status">
          Creation is unconfirmed. Retry to recover the same conversation.
        </p>
      )}
      <div className="flex gap-2">
        <Button
          disabled={
            !connected ||
            creation.isPending ||
            (request === undefined && title.trim() === "")
          }
          size="sm"
          type="submit"
        >
          {creation.isPending
            ? "Creating…"
            : request === undefined
              ? "Create"
              : "Retry"}
        </Button>
        {request === undefined && (
          <Button
            disabled={creation.isPending}
            onClick={() => setOpen(false)}
            size="sm"
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
        )}
      </div>
      {creation.error && (
        <p className="text-xs text-destructive" role="alert">
          {creation.error.message}
        </p>
      )}
      {!isPersistent && (
        <p className="text-xs text-destructive" role="alert">
          Your draft could not be saved. Keep this tab open to retain it.
        </p>
      )}
    </form>
  );
}
