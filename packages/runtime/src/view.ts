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
import type { Message } from "@earendil-works/pi-ai";
import * as pi from "@earendil-works/pi-durable";
import type {
  ConversationState,
  ConversationSummary,
  LabError,
  SubmissionState,
} from "@lab/contracts";
import { ConversationDoc } from "./metadata";
import { observe, submissionState } from "./pi";

export class ConversationObservation
  implements AttachedReplicatedState<ConversationState>
{
  private readonly submissions = new Map<pi.SubmissionId, SubmissionState>();
  private readonly changed = new Set<pi.SubmissionId>();
  private readonly disposers: (() => void)[] = [];
  private readonly entries = new WeakMap<
    pi.EntryRecord,
    ConversationState["entries"][number]
  >();
  private source: AttachedReplicatedState<pi.ConversationView> | undefined;
  private summary: ConversationSummary | undefined;
  private state: MutableReplicatedState<ConversationState> | undefined;
  private scheduled = false;
  private disposed = false;
  private unavailable = false;

  private constructor() {}

  static async open(
    harness: pi.Harness,
    storage: pi.Storage,
    conversation: pi.Conversation,
    context: Context,
  ): Promise<ConversationObservation> {
    const observation = new ConversationObservation();

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

      const metadata = await harness.snapshot(
        ConversationDoc,
        conversation.id,
        context,
      );

      context.abortSignal?.throwIfAborted();

      if (observation.unavailable) {
        throw new pi.SessionFailed("Runtime is unavailable");
      }

      if (metadata === undefined) {
        throw new Error("Conversation metadata is unavailable");
      }

      observation.summary = {
        id: conversation.id,
        title: metadata.title,
        createdAt: metadata.createdAt,
      };
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

      if (this.unavailable) {
        this.dispose();
      }
    });
  }

  private project(): ConversationState {
    if (this.source === undefined || this.summary === undefined) {
      throw new Error("Conversation observation is not ready");
    }

    const source = this.source.value;
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
    const error = conversationError(live, latest);

    return {
      conversation: this.summary,
      busy: live?.run !== undefined,
      entries: source.entries.map((entry) => {
        const value = this.entries.get(entry) ?? {
          id: entry.id,
          kind: entry.kind,
          messages: (entry.model ?? []).map((message) => ({
            role: message.role === "toolResult" ? "tool" : message.role,
            text: contentText(message.content),
          })),
        };

        this.entries.set(entry, value);
        return value;
      }),
      ...(partial === undefined
        ? {}
        : { partial: contentText(partial.content) }),
      tools: [
        ...(live?.tools ?? []).map((tool) => ({
          callId: tool.callId,
          name: tool.name,
          status: tool.status,
          output:
            tool.output ??
            source.entries
              .find(({ id }) => id === tool.entry)
              ?.model?.map((message) => contentText(message.content))
              .join("\n") ??
            "",
        })),
        ...(live?.nestedTools ?? []).map((tool) => ({
          callId: tool.callId,
          name: tool.name,
          status: tool.status,
          output: tool.output ?? tool.summary?.error ?? "",
        })),
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
      ...(error === undefined ? {} : { error }),
    };
  }
}

function contentText(content: Message["content"]): string {
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
    return {
      code: "unavailable",
      message: "Conversation ended without an answer.",
    };
  }

  return undefined;
}
