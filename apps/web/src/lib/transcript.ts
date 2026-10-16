import {
  type ConversationState,
  type Message,
  omitUndefined,
  type ToolProgress,
} from "@lab/wire";

type TranscriptMessage = Exclude<Message, { role: "tool" }> & { id: string };

type TranscriptItem =
  | { type: "message"; id: string; message: TranscriptMessage }
  | { type: "activity"; id: string; calls: ToolProgress[] };

export function transcriptItems(state: ConversationState): TranscriptItem[] {
  const messages = state.entries.flatMap((entry) =>
    entry.messages.map((message, index) => ({
      ...message,
      id: `${entry.id}:${index}`,
    })),
  );

  const results = new Map(
    messages.flatMap((message) =>
      message.role === "tool" ? [[message.tool.callId, message] as const] : [],
    ),
  );

  const live = new Map(state.tools.map((tool) => [tool.callId, tool]));
  const seen = new Set<string>();

  const items: TranscriptItem[] = [];

  function appendTool(call: {
    callId: string;
    name: string;
    arguments?: Record<string, unknown>;
  }) {
    if (seen.has(call.callId)) {
      return;
    }

    seen.add(call.callId);

    const result = results.get(call.callId);
    const progress = live.get(call.callId);
    const args = call.arguments ?? progress?.arguments;

    const tool: ToolProgress =
      result === undefined
        ? {
            ...(progress ?? {
              callId: call.callId,
              name: call.name,
              status: "interrupted",
              output: "",
            }),
            ...omitUndefined({ arguments: args }),
          }
        : {
            callId: call.callId,
            name: call.name,
            status: result.tool.isError ? "failed" : "succeeded",
            output: result.text,
            ...omitUndefined({
              arguments: args,
              details: result.tool.details,
              durationMs: result.tool.durationMs,
            }),
          };

    const previous = items.at(-1);

    if (previous?.type === "activity") {
      previous.calls.push(tool);
    } else {
      items.push({
        type: "activity",
        id: `tool:${call.callId}`,
        calls: [tool],
      });
    }
  }

  for (const message of messages) {
    if (message.role === "tool") {
      appendTool(message.tool);
      continue;
    }

    if (message.role === "user" || message.text.trim().length > 0) {
      items.push({ type: "message", id: message.id, message });
    }

    if (message.role === "assistant") {
      for (const call of message.toolCalls) {
        appendTool(call);
      }
    }
  }

  for (const tool of state.tools) {
    appendTool(tool);
  }

  return items;
}
