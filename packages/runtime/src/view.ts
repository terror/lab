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
import type {
  ConversationState,
  ConversationSummary,
  LabError,
  Message,
  SubmissionState,
  ToolProgress,
  ToolResult,
} from "@lab/wire";
import { ConversationDoc, parseConversationDoc } from "./metadata";
import type { ToolRegistry } from "./tool-registry";

type InputSubmission = Extract<pi.SubmissionRecord, { type: "input" }>;

export class ConversationObservation
  implements AttachedReplicatedState<ConversationState>
{
  private readonly disposers: (() => void)[] = [];
  private readonly entries = new WeakMap<
    pi.EntryRecord,
    ConversationState["entries"][number]
  >();

  private deleted = false;
  private disposed = false;
  private latest: InputSubmission | undefined;
  private latestNonQueued: InputSubmission | undefined;
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

            observation.updateSubmission(change.value);
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

      const source = await conversation.viewState(context);

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
          if (record.type === "input") {
            observation.updateSubmission(record, false);
          }
        }

        const latestNonQueued = observation.latestNonQueued?.id;

        cursor =
          latestNonQueued !== undefined &&
          page.items.some(({ id }) => id <= latestNonQueued)
            ? undefined
            : page.next;
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

      const value = parseConversationDoc(metadata.value);

      observation.deleted = value.deleted;

      observation.summary = {
        id: conversation.id,
        title: value.title,
        createdAt: value.createdAt,
      };

      observation.disposers.push(
        metadata.subscribe((snapshot, context) => {
          if (snapshot === null) {
            return;
          }

          const value = parseConversationDoc(snapshot);

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

    this.latest = undefined;
    this.latestNonQueued = undefined;
  }

  private get current() {
    if (this.state === undefined) {
      throw new Error("Conversation observation is not ready");
    }

    return this.state;
  }

  private updateSubmission(record: InputSubmission, replace = true) {
    if (
      this.latest === undefined ||
      record.id > this.latest.id ||
      (replace && record.id === this.latest.id)
    ) {
      this.latest = record;
    }

    if (
      record.status !== "queued" &&
      (this.latestNonQueued === undefined ||
        record.id > this.latestNonQueued.id ||
        (replace && record.id === this.latestNonQueued.id))
    ) {
      this.latestNonQueued = record;
    }
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

    const error =
      this.tools.error(agent) ?? conversationError(live, this.latestNonQueued);

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
      ...(this.latest === undefined
        ? {}
        : {
            latestSubmission:
              this.latest.status === "unanswered"
                ? { status: this.latest.status, reason: this.latest.reason }
                : { status: this.latest.status },
          }),
      ...(error === undefined ? {} : { error }),
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
        tool: {
          callId: message.toolCallId,
          name: message.toolName,
          isError: message.isError,
          ...(message.durationMs === undefined
            ? {}
            : { durationMs: message.durationMs }),
          ...(message.details === undefined
            ? {}
            : { details: message.details }),
        },
      };
  }
}

function projectTool(
  tool: pi.ToolSlot | pi.NestedToolSlot,
  result: Pick<ToolResult, "isError" | "durationMs"> | undefined,
  output: string,
  details: unknown,
): ToolProgress {
  const progress = {
    callId: tool.callId,
    name: tool.name,
    output,
    ...("arguments" in tool && tool.arguments !== undefined
      ? { arguments: tool.arguments }
      : {}),
    ...(details === undefined ? {} : { details }),
  };

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
            ...(result.durationMs === undefined
              ? {}
              : { durationMs: result.durationMs }),
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
