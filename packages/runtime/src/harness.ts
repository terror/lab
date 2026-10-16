import type { AttachedReplicatedState, Context } from "@earendil-works/chord";
import * as pi from "@earendil-works/pi-durable";
import {
  type ConversationId,
  ConversationIdSchema,
  type ConversationPage,
  type ConversationState,
  type ConversationSummary,
  type ListConversationsInput,
  type ListModelsInput,
  type ModelCatalog,
  type ModelSelectionReceipt,
  type Result,
  type SetModelInput,
  type SetToolsInput,
  type StartConversationInput,
  type StopInput,
  type StopReceipt,
  type SubmissionReceipt,
  type SubmitInput,
  type ToolCatalog,
  type ToolSelectionReceipt,
} from "@lab/wire";
import { Type } from "typebox";
import { Check } from "typebox/value";
import type { ToolRegistry } from "./extensions";
import {
  type Configuration,
  ConversationDoc,
  parseConversationDoc,
  parseStartRequestDoc,
  StartRequestDoc,
} from "./metadata";
import type { ModelRegistry } from "./models";
import type { Runtime } from "./runtime";
import { TitleTask, UNTITLED_CONVERSATION } from "./tasks/titles";
import { ConversationObservation } from "./view";

const CursorSchema = Type.Object(
  {
    after: ConversationIdSchema,
    order: Type.Literal("descending"),
  },
  { additionalProperties: false },
);

export class Harness implements Runtime {
  private available = true;

  private readonly admissions = new Map<string, Promise<void>>();

  constructor(
    private readonly harness: pi.Harness,
    private readonly storage: pi.Storage,
    private readonly configuration: Configuration,
    private readonly tools: ToolRegistry,
    private readonly models: ModelRegistry,
  ) {
    harness.subscribeClose(() => {
      this.available = false;
    });
  }

  listTools(context: Context): Promise<Result<ToolCatalog>> {
    return this.perform(context, async () => ({
      ok: true,
      value: this.tools.catalog(),
    }));
  }

  listModels(
    input: ListModelsInput,
    context: Context,
  ): Promise<Result<ModelCatalog>> {
    return this.perform(context, async () => ({
      ok: true,
      value: await this.models.list(this.configuration.model, input, context),
    }));
  }

  listConversations(
    input: ListConversationsInput,
    context: Context,
  ): Promise<Result<ConversationPage>> {
    return this.perform(context, async () => {
      const cursor =
        input.cursor === undefined ? undefined : parseCursor(input.cursor);

      if (cursor === null) {
        return {
          ok: false,
          error: {
            code: "invalid_input",
            message: "Invalid conversation cursor.",
          },
        };
      }

      const page = await this.harness.commit(async (tx) => {
        const items: ConversationSummary[] = [];
        let next: pi.Cursor | undefined = cursor;

        do {
          const page = await tx.scanConversations(
            { order: "descending" },
            input.limit - items.length,
            next,
          );

          const summaries = await Promise.all(
            page.items.map(async ({ id }) => {
              const { title, createdAt, deleted } = parseConversationDoc(
                await tx.doc(ConversationDoc, id),
              );

              return deleted ? [] : [{ id, title, createdAt }];
            }),
          );

          items.push(...summaries.flat());
          next = page.next;
        } while (items.length < input.limit && next !== undefined);

        return {
          items,
          ...(next === undefined ? {} : { next: JSON.stringify(next) }),
        };
      }, context);

      return { ok: true, value: page };
    });
  }

  subscribeConversations(listener: (revision: number) => void): () => void {
    return this.harness.subscribeCommits((publication) => {
      if (
        publication.changes.some(
          (change) =>
            (change.type === "document" || change.type === "document.copy") &&
            change.record.kind === ConversationDoc.definition.kind,
        )
      ) {
        listener(publication.seq);
      }
    });
  }

  startConversation(
    input: StartConversationInput,
    context: Context,
  ): Promise<Result<SubmissionReceipt>> {
    return this.perform(context, () =>
      this.admit(`start:${input.requestId}`, context, async () => {
        const snapshot = await this.harness.snapshot(
          StartRequestDoc,
          input.requestId,
          context,
        );

        const request =
          snapshot === undefined ? undefined : parseStartRequestDoc(snapshot);

        if (request?.receipt != null) {
          const { receipt } = request;

          return this.withConversation(
            receipt.conversationId,
            context,
            async () => ({
              ok: true,
              value: receipt,
            }),
          );
        }

        const model = await this.models.validate(
          input.model ?? this.configuration.model,
          context,
        );

        if (!model.ok) {
          return model;
        }

        const tools = this.tools.select(
          input.tools ?? this.tools.catalog().defaultTools,
        );

        if (!tools.ok) {
          return tools;
        }

        const value = await this.harness.commit(async (tx) => {
          const request = parseStartRequestDoc(
            await tx.doc(StartRequestDoc, input.requestId, null),
          );

          if (request.receipt !== null) {
            return { ...request.receipt };
          }

          const { id } = await tx.createConversation({
            ownership: { kind: "ownerless" },
          });

          await pi.configure(tx, id, {
            model: model.value,
            extensions: this.tools.extensions,
            tools: tools.value,
          });

          parseConversationDoc(await tx.doc(ConversationDoc, id)).title =
            input.title;

          const entry = await tx.appendEntry(pi.UserEntry, id, {
            model: [
              { role: "user", content: input.content, timestamp: Date.now() },
            ],
          });

          const submission = await tx.createSubmission({
            conversationId: id,
            requestId: input.requestId,
            type: "input",
            status: "placed",
            entry: entry.id,
          });

          const live = await tx.doc(pi.LiveDoc, id);

          live.run = {
            taskId: await tx.createTask(
              pi.GenerationTask,
              {},
              { conversationId: id, ownership: { kind: "conversation" } },
            ),
            inputs: [submission.id],
          };

          const receipt: SubmissionReceipt = {
            conversationId: id,
            submissionId: submission.id,
            requestId: input.requestId,
            status: "admitted",
          };

          if (
            input.title === UNTITLED_CONVERSATION &&
            input.content.trim() !== ""
          ) {
            await tx.createTask(
              TitleTask,
              {
                content: input.content.slice(0, 8000),
                model: model.value,
              },
              {
                conversationId: id,
                ownership: { kind: "conversation" },
                background: true,
              },
            );
          }

          request.receipt = receipt;

          return receipt;
        }, context);

        return this.withConversation(
          value.conversationId,
          context,
          async () => ({ ok: true, value }),
        );
      }),
    );
  }

  deleteConversation(
    id: ConversationId,
    context: Context,
  ): Promise<Result<null>> {
    return this.perform(context, () =>
      this.withConversation(
        id,
        context,
        async (handle) => {
          await handle.abort(context, { background: true });

          await this.harness.commit(async (tx) => {
            parseConversationDoc(
              await tx.doc(ConversationDoc, handle.id),
            ).deleted = true;
          }, context);

          return { ok: true, value: null };
        },
        { includeDeleted: true },
      ),
    );
  }

  observeConversation(
    id: ConversationId,
    context: Context,
  ): Promise<Result<AttachedReplicatedState<ConversationState>>> {
    return this.perform(context, () =>
      this.withConversation(id, context, async (handle) => ({
        ok: true,
        value: await ConversationObservation.open(
          this.harness,
          this.storage,
          handle,
          this.tools,
          context,
        ),
      })),
    );
  }

  submit(
    id: ConversationId,
    input: SubmitInput,
    context: Context,
  ): Promise<Result<SubmissionReceipt>> {
    return this.perform(context, () =>
      this.withConversation(id, context, async (handle) => {
        const existing = await this.harness.commit(
          (tx) => tx.submissionByRequest(handle.id, input.requestId),
          context,
        );

        if (existing === undefined) {
          const error = this.tools.error(
            await this.harness.snapshot(pi.AgentDoc, handle.id, context),
          );

          if (error !== undefined) {
            return { ok: false, error };
          }

          const model = await this.models.validate(
            (await handle.agent(context)).model,
            context,
          );

          if (!model.ok) {
            return model;
          }
        }

        const submission = await handle.submit(
          {
            type: "input",
            content: input.content,
            requestId: input.requestId,
            whenBusy: input.whenBusy,
          },
          context,
        );

        return {
          ok: true,
          value: {
            conversationId: handle.id,
            submissionId: submission.id,
            requestId: input.requestId,
            status: "admitted",
          },
        };
      }),
    );
  }

  setModel(
    id: ConversationId,
    input: SetModelInput,
    context: Context,
  ): Promise<Result<ModelSelectionReceipt>> {
    return this.perform(context, () =>
      this.withConversation(id, context, async (handle) => {
        const model = await this.models.validate(input.model, context);

        if (!model.ok) {
          return model;
        }

        await handle.configure({ model: model.value }, context);

        return {
          ok: true,
          value: {
            conversationId: handle.id,
            model: model.value,
            appliesAt: "next_request_preparation",
          },
        };
      }),
    );
  }

  setTools(
    id: ConversationId,
    input: SetToolsInput,
    context: Context,
  ): Promise<Result<ToolSelectionReceipt>> {
    return this.perform(context, () =>
      this.withConversation(id, context, async (handle) => {
        const tools = this.tools.select(input.tools);

        if (!tools.ok) {
          return tools;
        }

        await this.harness.commit(async (tx) => {
          const live = await tx.doc(pi.LiveDoc, handle.id);
          const inbox = await tx.doc(pi.InboxDoc, handle.id);

          if (live.run !== undefined || inbox.items.length > 0) {
            throw new pi.ConversationBusy(handle.id);
          }

          await pi.configure(tx, handle.id, {
            extensions: this.tools.extensions,
            tools: tools.value,
          });
        }, context);

        return {
          ok: true,
          value: {
            conversationId: handle.id,
            tools: [...input.tools],
            appliesAt: "next_submission",
          },
        };
      }),
    );
  }

  stop(
    id: ConversationId,
    input: StopInput,
    context: Context,
  ): Promise<Result<StopReceipt>> {
    return this.perform(context, () =>
      this.withConversation(id, context, async (handle) => {
        await handle.abort(context, { background: input.scope === "all" });

        return {
          ok: true,
          value: {
            conversationId: handle.id,
            scope: input.scope,
            status: "stopped",
          },
        };
      }),
    );
  }

  private withConversation<T>(
    id: ConversationId,
    context: Context,
    operation: (handle: pi.Conversation) => Promise<Result<T>>,
    options: { includeDeleted?: boolean } = {},
  ): Promise<Result<T>> {
    return this.admit(`conversation:${id}`, context, async () => {
      const handle = await this.harness.conversation(
        id as pi.ConversationId,
        context,
      );

      const metadata =
        handle === undefined || options.includeDeleted
          ? undefined
          : await this.harness.snapshot(ConversationDoc, handle.id, context);

      if (
        handle === undefined ||
        (metadata !== undefined && parseConversationDoc(metadata).deleted)
      ) {
        return {
          ok: false,
          error: { code: "not_found", message: "Conversation not found." },
        };
      }

      return operation(handle);
    });
  }

  private async admit<T>(
    key: string,
    context: Context,
    operation: () => Promise<Result<T>>,
  ): Promise<Result<T>> {
    const pending = (this.admissions.get(key) ?? Promise.resolve()).then(() => {
      context.abortSignal?.throwIfAborted();
      return operation();
    });

    const settled = pending.then(
      () => undefined,
      () => undefined,
    );

    this.admissions.set(key, settled);

    try {
      return await pending;
    } finally {
      if (this.admissions.get(key) === settled) {
        this.admissions.delete(key);
      }
    }
  }

  private async perform<T>(
    context: Context,
    operation: () => Promise<Result<T>>,
  ): Promise<Result<T>> {
    context.abortSignal?.throwIfAborted();

    if (!this.available) {
      return {
        ok: false,
        error: { code: "unavailable", message: "Runtime is unavailable." },
      };
    }

    try {
      return await operation();
    } catch (error) {
      context.abortSignal?.throwIfAborted();

      if (!this.available || error instanceof pi.SessionFailed) {
        return {
          ok: false,
          error: { code: "unavailable", message: "Runtime is unavailable." },
        };
      }

      if (error instanceof pi.ConversationBusy) {
        return {
          ok: false,
          error: { code: "busy", message: "Conversation is busy." },
        };
      }

      if (error instanceof pi.StorageRequestError) {
        return {
          ok: false,
          error: { code: "invalid_input", message: "Invalid runtime request." },
        };
      }

      return {
        ok: false,
        error: { code: "internal", message: "Runtime operation failed." },
      };
    }
  }
}

function parseCursor(cursor: string) {
  try {
    const value: unknown = JSON.parse(cursor);
    return Check(CursorSchema, value) ? value : null;
  } catch {
    return null;
  }
}
