import type { ConversationState } from "@lab/contracts";
import {
  ArrowDown,
  CircleDashed,
  CornerDownRight,
  LoaderCircle,
  MessageSquare,
} from "lucide-react";
import { memo } from "react";
import { StickToBottom } from "use-stick-to-bottom";
import { CopyButton } from "@/components/copy-button";
import { MessageContent } from "@/components/message-content";
import { ToolActivity } from "@/components/tool-activity";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { transcriptItems } from "@/lib/transcript";
import { cn } from "@/lib/utils";

type Message = ConversationState["entries"][number]["messages"][number];

export function Transcript({
  state,
  stale,
}: {
  state: ConversationState;
  stale: boolean;
}) {
  const items = transcriptItems(state);
  const activeTools = items.some(
    (item) =>
      item.type === "activity" &&
      item.calls.some(
        (call) => call.status === "pending" || call.status === "running",
      ),
  );
  const partial = state.partial?.trim() ? state.partial : undefined;
  const empty =
    items.length === 0 &&
    !state.busy &&
    partial === undefined &&
    state.inbox.length === 0;
  const status =
    activeTools || !state.busy
      ? undefined
      : stale
        ? "Last known state: working"
        : partial === undefined
          ? "Working…"
          : "Writing…";

  return (
    <StickToBottom
      aria-label="Conversation messages"
      className="relative min-h-0 flex-1"
      initial="instant"
      resize="instant"
      role="region"
    >
      {({ isAtBottom, scrollToBottom }) => (
        <>
          <StickToBottom.Content
            className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6"
            scrollClassName="overflow-y-auto overscroll-contain"
          >
            {empty ? (
              <div className="flex flex-col items-center px-3 py-16 text-center">
                <div className="panel-frame mb-5 flex size-12 items-center justify-center border bg-card text-primary">
                  <MessageSquare aria-hidden="true" className="size-5" />
                </div>
                <h2 className="text-3xl font-normal tracking-tight">
                  Where should we start?
                </h2>
                <p className="mt-3 max-w-sm text-base leading-7 text-muted-foreground">
                  Ask a question, explore an idea, or work through something
                  together.
                </p>
              </div>
            ) : (
              <ol className="space-y-8">
                {items.map((item) =>
                  item.type === "activity" ? (
                    <li className="min-w-0" key={item.id}>
                      <ToolActivity calls={item.calls} stale={stale} />
                    </li>
                  ) : (
                    <TranscriptMessage
                      key={item.id}
                      role={item.message.role}
                      text={item.message.text}
                    />
                  ),
                )}
                {(partial !== undefined || status !== undefined) && (
                  <li className="space-y-4">
                    <span className="sr-only">Assistant</span>
                    {partial && <MessageContent text={partial} />}
                    {status && (
                      <div
                        className="flex items-center gap-2.5 py-2 font-sans text-sm text-muted-foreground"
                        role="status"
                      >
                        {stale ? (
                          <CircleDashed aria-hidden="true" className="size-4" />
                        ) : (
                          <LoaderCircle
                            aria-hidden="true"
                            className="size-4 motion-safe:animate-spin"
                          />
                        )}
                        {status}
                      </div>
                    )}
                  </li>
                )}
                {state.inbox.map((input) => (
                  <li
                    className="ml-auto w-fit max-w-[90%] space-y-2 rounded-sm border border-dashed bg-card px-5 py-3"
                    key={input.submissionId}
                  >
                    <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                      <CornerDownRight
                        aria-hidden="true"
                        className="size-3.5"
                      />
                      {input.mode === "steer"
                        ? "Steering message"
                        : "Next message"}
                      <span>· Queued</span>
                    </p>
                    <p className="text-base leading-7 whitespace-pre-wrap break-words">
                      {input.content}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </StickToBottom.Content>
          {!isAtBottom && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  aria-label="Jump to latest message"
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-sm bg-card shadow-md"
                  onClick={() => void scrollToBottom("instant")}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Jump to latest</TooltipContent>
            </Tooltip>
          )}
        </>
      )}
    </StickToBottom>
  );
}

const TranscriptMessage = memo(function TranscriptMessage({
  role,
  text,
}: Message) {
  if (role === "system") {
    return (
      <li className="space-y-2 rounded-sm border bg-card px-4 py-3 text-sm text-muted-foreground">
        <p className="font-mono text-[10px] tracking-wider uppercase">System</p>
        <p className="leading-6 whitespace-pre-wrap break-words">{text}</p>
      </li>
    );
  }

  return (
    <li
      className={cn(
        "min-w-0",
        role === "user" ? "ml-auto w-fit max-w-[90%]" : "space-y-2",
      )}
    >
      <span className="sr-only">{role === "user" ? "You" : "Assistant"}</span>
      {role === "user" ? (
        <p className="rounded-sm border border-primary/20 bg-accent/60 px-5 py-3 text-base leading-7 whitespace-pre-wrap break-words">
          {text || "No text content."}
        </p>
      ) : (
        <MessageContent text={text} />
      )}
      <div
        className={cn("flex", role === "user" ? "justify-end pt-1" : "-ml-2")}
      >
        <CopyButton
          label={role === "user" ? "Copy message" : "Copy response"}
          text={text}
        />
      </div>
    </li>
  );
});
