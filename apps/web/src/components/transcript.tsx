import type { ConversationState } from "@lab/contracts";
import { StickToBottom } from "use-stick-to-bottom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const roles = {
  user: "You",
  assistant: "Assistant",
  tool: "Tool",
  system: "System",
};

export function Transcript({
  state,
  stale,
}: {
  state: ConversationState;
  stale: boolean;
}) {
  const messages = state.entries.flatMap((entry) =>
    entry.messages.map((message, index) => ({
      ...message,
      id: `${entry.id}:${index}`,
    })),
  );

  return (
    <StickToBottom
      aria-label="Transcript"
      className="relative min-h-0 flex-1"
      initial="instant"
      resize="instant"
      role="region"
    >
      {({ isAtBottom, scrollToBottom }) => (
        <>
          <StickToBottom.Content
            className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 md:px-6"
            scrollClassName="overflow-y-auto overscroll-contain"
          >
            {messages.length === 0 &&
              !state.busy &&
              state.partial === undefined &&
              state.inbox.length === 0 && (
                <div className="space-y-2 py-8 text-center">
                  <h2 className="text-xl font-semibold tracking-tight">
                    Start the conversation
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Send a message to begin working with your agent.
                  </p>
                </div>
              )}
            <ol className="space-y-6">
              {messages.map((message) => (
                <li
                  className={cn(
                    "space-y-2",
                    message.role === "user" &&
                      "ml-auto max-w-[90%] rounded-xl bg-muted px-4 py-3",
                  )}
                  key={message.id}
                >
                  <p className="text-xs font-medium text-muted-foreground">
                    {roles[message.role]}
                  </p>
                  <p className="text-sm leading-7 whitespace-pre-wrap break-words">
                    {message.text || "No text content."}
                  </p>
                </li>
              ))}
              {state.partial !== undefined && (
                <li className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Assistant · {stale ? "Last received output" : "Writing…"}
                  </p>
                  <p className="text-sm leading-7 whitespace-pre-wrap break-words">
                    {state.partial || "Thinking…"}
                  </p>
                </li>
              )}
            </ol>
            {state.tools.map((tool) => (
              <details
                className="rounded-md border p-3 text-sm"
                key={tool.callId}
              >
                <summary className="cursor-pointer font-medium">
                  {tool.name} · {tool.status}
                </summary>
                <pre className="mt-2 max-h-48 overflow-y-auto text-xs whitespace-pre-wrap break-words">
                  {tool.output || "No output yet."}
                </pre>
              </details>
            ))}
            {state.inbox.map((input) => (
              <div
                className="space-y-2 rounded-md border border-dashed p-3"
                key={input.submissionId}
              >
                <p className="text-xs font-medium text-muted-foreground">
                  Queued message
                </p>
                <p className="text-sm whitespace-pre-wrap break-words">
                  {input.content}
                </p>
              </div>
            ))}
            {state.busy && state.partial === undefined && (
              <p className="text-sm text-muted-foreground" role="status">
                {stale ? "Last known state: working." : "Working…"}
              </p>
            )}
          </StickToBottom.Content>
          {!isAtBottom && (
            <Button
              className="absolute bottom-3 left-1/2 -translate-x-1/2 shadow-sm"
              onClick={() => void scrollToBottom("instant")}
              size="sm"
              type="button"
              variant="outline"
            >
              Jump to latest
            </Button>
          )}
        </>
      )}
    </StickToBottom>
  );
}
