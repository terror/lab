import type { ConversationState } from "@lab/contracts";
import {
  ArrowDown,
  Check,
  ChevronDown,
  CircleDashed,
  CornerDownRight,
  LoaderCircle,
  MessageSquare,
  Terminal,
} from "lucide-react";
import { memo } from "react";
import { StickToBottom } from "use-stick-to-bottom";
import { CopyButton } from "@/components/copy-button";
import { MessageContent } from "@/components/message-content";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type Message = ConversationState["entries"][number]["messages"][number];
type ToolStatus = ConversationState["tools"][number]["status"];

export function Transcript({
  state,
  stale,
}: {
  state: ConversationState;
  stale: boolean;
}) {
  const messages = state.entries.flatMap((entry) =>
    entry.messages.flatMap((message, index) =>
      message.role === "assistant" && message.text.trim().length === 0
        ? []
        : [{ ...message, id: `${entry.id}:${index}` }],
    ),
  );
  const empty =
    messages.length === 0 &&
    !state.busy &&
    state.partial === undefined &&
    state.tools.length === 0 &&
    state.inbox.length === 0;
  const status =
    state.partial !== undefined
      ? stale
        ? "Last received output"
        : "Writing…"
      : state.busy
        ? stale
          ? "Last known state: working"
          : "Working…"
        : undefined;

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
                <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-muted">
                  <MessageSquare aria-hidden="true" className="size-5" />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Where should we start?
                </h2>
                <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
                  Ask a question, explore an idea, or work through something
                  together.
                </p>
              </div>
            ) : (
              <ol className="space-y-8">
                {messages.map((message) => (
                  <TranscriptMessage
                    key={message.id}
                    role={message.role}
                    text={message.text}
                  />
                ))}
                {state.tools.length > 0 && (
                  <li className="space-y-2">
                    <span className="sr-only">Current activity</span>
                    {state.tools.map((tool) => (
                      <ToolOutput
                        key={tool.callId}
                        name={tool.name}
                        output={tool.output}
                        stale={stale}
                        status={tool.status}
                      />
                    ))}
                  </li>
                )}
                {(state.partial !== undefined || status !== undefined) && (
                  <li className="space-y-4">
                    <span className="sr-only">Assistant</span>
                    {state.partial && <MessageContent text={state.partial} />}
                    {status && (
                      <div
                        className="flex items-center gap-2.5 text-sm text-muted-foreground"
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
                    className="ml-auto w-fit max-w-[90%] space-y-2 rounded-3xl border border-dashed bg-muted/35 px-5 py-3"
                    key={input.submissionId}
                  >
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
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
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-background shadow-md"
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
  if (role === "tool") {
    return (
      <li>
        <ToolOutput name="Tool output" output={text} />
      </li>
    );
  }

  if (role === "system") {
    return (
      <li className="space-y-2 rounded-2xl border px-4 py-3 text-sm text-muted-foreground">
        <p className="text-xs font-medium">System</p>
        <p className="leading-6 whitespace-pre-wrap break-words">
          {text || "No text content."}
        </p>
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
        <p className="rounded-3xl bg-muted px-5 py-3 text-base leading-7 whitespace-pre-wrap break-words">
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

const ToolOutput = memo(function ToolOutput({
  name,
  output,
  status,
  stale = false,
}: {
  name: string;
  output: string;
  status?: ToolStatus;
  stale?: boolean;
}) {
  const label =
    status === "done"
      ? "Done"
      : status === "running"
        ? "Running"
        : status === "pending"
          ? "Queued"
          : undefined;

  return (
    <Collapsible className="min-w-0 overflow-hidden rounded-xl border bg-muted/20">
      <CollapsibleTrigger asChild>
        <Button
          className="group/tool h-auto min-h-11 w-full justify-start gap-2.5 rounded-xl px-3 py-2 text-left font-normal text-muted-foreground"
          type="button"
          variant="ghost"
        >
          {status === "running" && !stale ? (
            <LoaderCircle
              aria-hidden="true"
              className="motion-safe:animate-spin"
            />
          ) : status === "done" ? (
            <Check aria-hidden="true" />
          ) : (
            <Terminal aria-hidden="true" />
          )}
          <span className="min-w-0 flex-1 truncate text-foreground">
            {name}
          </span>
          {label && (
            <span className="text-xs">
              {stale ? `Last received: ${label.toLowerCase()}` : label}
            </span>
          )}
          <ChevronDown
            aria-hidden="true"
            className="transition-transform group-data-[state=open]/tool:rotate-180 motion-reduce:transition-none"
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ScrollArea
          className="border-t"
          viewportProps={{
            "aria-label": `${name} output`,
            className: "max-h-72",
            role: "region",
            tabIndex: 0,
          }}
        >
          <pre className="px-4 py-3 font-mono text-xs leading-6">
            {output ||
              (status === undefined ? "No text output." : "No output yet.")}
          </pre>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  );
});
