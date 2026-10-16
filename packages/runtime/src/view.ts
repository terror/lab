import {
  type AttachedReplicatedState,
  type Context,
  type MutableReplicatedState,
  type ReplicatedStateDelivery,
  replicatedState,
} from "@earendil-works/chord";
import {
  BACKGROUND_CONTEXT,
  withoutAbortSignal,
} from "@earendil-works/chord/context";
import type * as ai from "@earendil-works/pi-ai";
import * as pi from "@earendil-works/pi-durable";
import {
  type ConversationState,
  type ConversationSummary,
  type LabError,
  type Message,
  omitUndefined,
  type SubmissionState,
  type ToolProgress,
  type ToolResult,
} from "@lab/contracts";
import type { ToolRegistry } from "./extensions";
import { ConversationDoc } from "./metadata";
import { observe, submissionState } from "./pi";

export class ConversationObservation
  implements AttachedReplicatedState<ConversationState>
{
  private readonly changed = new Set<pi.SubmissionId>();
  private readonly disposers: (() => void)[] = [];
  private readonly entries = new WeakMap<
    pi.EntryRecord,
    ConversationState["entries"][number]
  >();
  private readonly submissions = new Map<pi.SubmissionId, SubmissionState>();

  private deleted = false;
  private disposed = false;
  private scheduled = false;
  private source: AttachedReplicatedState<pi.ConversationView> | undefined;
  private state: MutableReplicatedState<ConversationState> | undefined;
  private summary: ConversationSummary | undefined;
  private unavailable = false;

  private constructor(private readonly tools: ToolRegistry) {}

  static async open(
    harness: pi.Harness,
    storage: pi.Storage,
    conversation: pi.Conversation,
    tools: ToolRegistry,
    context: Context,
  ): Promise<ConversationObservation> {
    const observation = new ConversationObservation(tools);

    try {
      observation.disposers.push(
        harness.subscribeCommits((publication, context) => {
          for (const change of publication.changes) {
            if (
              change.type !== "submission" ||
              change.value.conversationId !== conversation.id ||
              change.value.type !== "input"
            ) {
              continue;
            }

            observation.submissions.set(
              change.value.id,
              submissionState(change.value),
            );

            if (observation.state === undefined) {
              observation.changed.add(change.value.id);
            }

            observation.schedule(context);
          }
        }),
      );

      observation.disposers.push(
        harness.subscribeClose(() => {
          observation.unavailable = true;
          observation.schedule(BACKGROUND_CONTEXT);
        }),
      );

      const source = await observe(conversation, context);
      observation.source = source;
      observation.disposers.push(() => source.dispose());
      observation.disposers.push(
        source.subscribe((_value, context) => observation.schedule(context)),
      );

      let cursor: pi.Cursor | undefined;

      do {
        context.abortSignal?.throwIfAborted();

        const page = await storage.scanSubmissions(
          { conversationId: conversation.id, order: "descending" },
          100,
          cursor,
          context,
        );

        for (const record of page.items) {
          if (record.type === "input" && !observation.changed.has(record.id)) {
            observation.submissions.set(record.id, submissionState(record));
          }
        }

        cursor = page.next;
      } while (cursor !== undefined);

      const metadata = await harness.documentState(
        ConversationDoc,
        conversation.id,
        context,
      );

      if (metadata !== undefined) {
        observation.disposers.push(() => metadata.dispose());
      }

      context.abortSignal?.throwIfAborted();

      if (observation.unavailable) {
        throw new pi.SessionFailed("Runtime is unavailable");
      }

      if (metadata === undefined || metadata.value === null) {
        throw new Error("Conversation metadata is unavailable");
      }

      observation.deleted = metadata.value.deleted;
      observation.summary = {
        id: conversation.id,
        title: metadata.value.title,
        createdAt: metadata.value.createdAt,
      };
      observation.disposers.push(
        metadata.subscribe((value, context) => {
          if (value === null) {
            return;
          }

          observation.deleted = value.deleted;
          observation.summary = {
            id: conversation.id,
            title: value.title,
            createdAt: value.createdAt,
          };
          observation.schedule(context);
        }),
      );
      observation.state = replicatedState(observation.project());
      observation.changed.clear();

      return observation;
    } catch (error) {
      observation.dispose();
      throw error;
    }
  }

  get value(): ConversationState {
    return this.current.value;
  }

  subscribe(
    listener: (
      value: ConversationState,
      context: Context,
      delivery: ReplicatedStateDelivery,
    ) => void | Promise<void>,
  ): () => void {
    return this.current.subscribe(listener);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    for (const dispose of this.disposers.splice(0).reverse()) {
      dispose();
    }

    this.source = undefined;
    this.submissions.clear();
    this.changed.clear();
  }

  private get current() {
    if (this.state === undefined) {
      throw new Error("Conversation observation is not ready");
    }

    return this.state;
  }

  private schedule(context: Context) {
    if (this.disposed || this.scheduled || this.state === undefined) {
      return;
    }

    this.scheduled = true;

    queueMicrotask(() => {
      this.scheduled = false;

      if (this.disposed) {
        return;
      }

      const value = this.unavailable
        ? {
            ...this.value,
            error: {
              code: "unavailable" as const,
              message: "Runtime is unavailable.",
            },
          }
        : this.project();

      this.current.replace(withoutAbortSignal(context), value);

      if (this.unavailable || this.deleted) {
        this.dispose();
      }
    });
  }

  private project(): ConversationState {
    if (this.source === undefined || this.summary === undefined) {
      throw new Error("Conversation observation is not ready");
    }

    if (this.deleted) {
      return {
        conversation: this.summary,
        selectedTools: [],
        busy: false,
        entries: [],
        tools: [],
        inbox: [],
        submissions: [],
        error: { code: "not_found", message: "Conversation not found." },
      };
    }

    const source = this.source.value;

    const agent = source.docs[pi.AgentDoc.definition.kind] as
      | pi.AgentState
      | undefined;

    const live = source.docs[pi.LiveDoc.definition.kind] as
      | pi.LiveState
      | undefined;

    const inbox = source.docs[pi.InboxDoc.definition.kind] as
      | pi.InboxState
      | undefined;

    const partial = live?.generation?.message;

    const submissions = [...this.submissions.values()].sort(
      (a, b) => a.id - b.id,
    );

    const latest = submissions.findLast(({ status }) => status !== "queued");
    const error = this.tools.error(agent) ?? conversationError(live, latest);

    return {
      conversation: this.summary,
      ...(agent?.model === undefined ? {} : { model: { ...agent.model } }),
      selectedTools: this.tools.selection(agent),
      busy: live?.run !== undefined,
      entries: source.entries.map((entry) => {
        const value = this.entries.get(entry) ?? {
          id: entry.id,
          kind: entry.kind,
          messages: (entry.model ?? []).map(projectMessage),
        };

        this.entries.set(entry, value);
        return value;
      }),
      ...(partial === undefined
        ? {}
        : { partial: contentText(partial.content) }),
      tools: [
        ...(live?.tools ?? []).map((tool) => {
          const result = source.entries
            .find(({ id }) => id === tool.entry)
            ?.model?.find((message) => message.role === "toolResult");

          return projectTool(
            tool,
            result,
            tool.output ??
              (result === undefined ? "" : contentText(result.content)),
            result === undefined ? tool.details : result.details,
          );
        }),
        ...(live?.nestedTools ?? []).map((tool) =>
          projectTool(
            tool,
            tool.summary,
            tool.output ?? tool.summary?.error ?? "",
            tool.details,
          ),
        ),
      ],
      inbox: (inbox?.items ?? []).flatMap((item) =>
        item.mode === "write"
          ? []
          : [
              {
                submissionId: item.id,
                content: contentText(item.content),
                mode: item.mode,
              },
            ],
      ),
      submissions,
      ...omitUndefined({ error }),
    };
  }
}

function projectMessage(message: ai.Message): Message {
  const text = contentText(message.content);

  switch (message.role) {
    case "user":
    case "system":
      return { role: message.role, text };
    case "assistant":
      return {
        role: message.role,
        text,
        toolCalls: message.content.flatMap((block) =>
          block.type === "toolCall"
            ? [
                {
                  callId: block.id,
                  name: block.name,
                  arguments: block.arguments,
                },
              ]
            : [],
        ),
      };
    case "toolResult":
      return {
        role: "tool",
        text,
        tool: omitUndefined({
          callId: message.toolCallId,
          name: message.toolName,
          isError: message.isError,
          durationMs: message.durationMs,
          details: message.details,
        }),
      };
  }
}

function projectTool(
  tool: pi.ToolSlot | pi.NestedToolSlot,
  result: Pick<ToolResult, "isError" | "durationMs"> | undefined,
  output: string,
  details: unknown,
): ToolProgress {
  const progress = omitUndefined({
    callId: tool.callId,
    name: tool.name,
    output,
    arguments: "arguments" in tool ? tool.arguments : undefined,
    details,
  });

  switch (tool.status) {
    case "pending":
    case "running":
      return { ...progress, status: tool.status };
    case "done":
      return result === undefined
        ? { ...progress, status: "interrupted" }
        : {
            ...progress,
            status: result.isError ? "failed" : "succeeded",
            ...omitUndefined({ durationMs: result.durationMs }),
          };
  }
}

function contentText(content: ai.Message["content"]): string {
  return typeof content === "string"
    ? content
    : content
        .flatMap((block) => (block.type === "text" ? [block.text] : []))
        .join("");
}

function conversationError(
  live: pi.LiveState | undefined,
  latest: SubmissionState | undefined,
): LabError | undefined {
  if (live?.generation?.retry !== undefined) {
    return { code: "unavailable", message: "Model request failed. Retrying." };
  }

  if (
    live?.run === undefined &&
    latest?.status === "unanswered" &&
    latest.reason !== "aborted" &&
    latest.reason !== "reset"
  ) {
    if (latest.reason === "no_model") {
      return {
        code: "model_unavailable",
        message:
          "The last request's model is unavailable. Select an available model and submit again.",
      };
    }

    if (latest.reason === "model_error") {
      return {
        code: "unavailable",
        message:
          "Model request failed. Check provider availability and credentials.",
      };
    }

    return {
      code: "unavailable",
      message: "Conversation ended without an answer.",
    };
  }

  return undefined;
}
