import type { ConversationState } from "@lab/contracts";

type Message = ConversationState["entries"][number]["messages"][number];

type TranscriptMessage = Message & { id: string };

export type ActivityCall = {
  callId: string;
  name: string;
  status: "pending" | "running" | "done" | "error" | "stopped";
  output: string;
  arguments?: Record<string, unknown>;
  details?: unknown;
  durationMs?: number;
};

type TranscriptItem =
  | { type: "message"; id: string; message: TranscriptMessage }
  | { type: "activity"; id: string; calls: ActivityCall[] };

export function transcriptItems(state: ConversationState): TranscriptItem[] {
  const messages = state.entries.flatMap((entry) =>
    entry.messages.map((message, index) => ({
      ...message,
      id: `${entry.id}:${index}`,
    })),
  );
  const results = new Map(
    messages.flatMap((message) =>
      message.role === "tool" && message.tool !== undefined
        ? [[message.tool.callId, message] as const]
        : [],
    ),
  );
  const live = new Map(state.tools.map((tool) => [tool.callId, tool]));
  const seen = new Set<string>();
  const items: TranscriptItem[] = [];

  function appendTool(
    call: {
      callId: string;
      name: string;
      arguments?: Record<string, unknown>;
    },
    fallback?: TranscriptMessage,
  ) {
    if (seen.has(call.callId)) {
      return;
    }

    seen.add(call.callId);

    const result = results.get(call.callId) ?? fallback;
    const progress = live.get(call.callId);
    const status =
      result !== undefined
        ? result.tool?.isError
          ? "error"
          : "done"
        : progress === undefined
          ? "stopped"
          : progress.status !== "done"
            ? progress.status
            : progress.isError === undefined
              ? "stopped"
              : progress.isError
                ? "error"
                : "done";
    const tool: ActivityCall = {
      callId: call.callId,
      name: call.name,
      status,
      output: result?.text ?? progress?.output ?? "",
      arguments: call.arguments ?? progress?.arguments,
      details: result === undefined ? progress?.details : result.tool?.details,
      durationMs: result?.tool?.durationMs ?? progress?.durationMs,
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
      appendTool(message.tool ?? { callId: message.id, name: "tool" }, message);
      continue;
    }

    if (message.role === "user" || message.text.trim().length > 0) {
      items.push({ type: "message", id: message.id, message });
    }

    for (const call of message.toolCalls ?? []) {
      appendTool(call);
    }
  }

  for (const tool of state.tools) {
    appendTool(tool);
  }

  return items;
}
