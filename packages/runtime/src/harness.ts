import type { AttachedReplicatedState, Context } from "@earendil-works/chord";
import * as pi from "@earendil-works/pi-durable";
import {
  type ConversationId,
  ConversationIdSchema,
  type ConversationPage,
  type ConversationState,
  type ConversationSummary,
  CreateConversationInputSchema,
  ListConversationsInputSchema,
  ListModelsInputSchema,
  type ModelCatalog,
  type ModelSelectionReceipt,
  type Result,
  SetModelInputSchema,
  SetToolsInputSchema,
  StopInputSchema,
  type StopReceipt,
  type SubmissionReceipt,
  SubmitInputSchema,
  type ToolCatalog,
  type ToolSelectionReceipt,
} from "@lab/contracts";
import { type Static, type TSchema, Type } from "typebox";
import { Check } from "typebox/value";
import type { ToolRegistry } from "./extensions";
import {
  type Configuration,
  ConversationDoc,
  CreationRequestDoc,
  parseConversationDoc,
  parseCreationRequestDoc,
} from "./metadata";
import type { ModelRegistry } from "./models";
import { conversation, runtimeError, stop, submit } from "./pi";
import type { Runtime } from "./runtime";
import { TitleTask, UNTITLED_CONVERSATION } from "./titles";
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
    return this.perform(Type.Object({}), {}, context, async () => ({
      ok: true,
      value: this.tools.catalog(),
    }));
  }

  listModels(input: unknown, context: Context): Promise<Result<ModelCatalog>> {
    return this.perform(
      ListModelsInputSchema,
      input,
      context,
      async (input) => ({
        ok: true,
        value: await this.models.list(this.configuration.model, input, context),
      }),
    );
  }

  listConversations(
    input: unknown,
    context: Context,
  ): Promise<Result<ConversationPage>> {
    return this.perform(
      ListConversationsInputSchema,
      input,
      context,
      async (input) => {
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
      },
    );
  }

  createConversation(
    input: unknown,
    context: Context,
  ): Promise<Result<ConversationSummary>> {
    return this.perform(
      CreateConversationInputSchema,
      input,
      context,
      (input) =>
        this.admit(`create:${input.requestId}`, context, async () => {
          const snapshot = await this.harness.snapshot(
            CreationRequestDoc,
            input.requestId,
            context,
          );
          const request =
            snapshot === undefined
              ? undefined
              : parseCreationRequestDoc(snapshot);

          if (request?.conversationId != null) {
            return this.withConversation(
              request.conversationId,
              context,
              async (handle) => ({
                ok: true,
                value: await this.harness.commit(
                  (tx) => summary(tx, handle.id),
                  context,
                ),
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
            const request = parseCreationRequestDoc(
              await tx.doc(CreationRequestDoc, input.requestId, null),
            );

            if (request.conversationId !== null) {
              return summary(tx, request.conversationId);
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

            if (input.title === UNTITLED_CONVERSATION) {
              await tx.createTask(
                TitleTask,
                {},
                {
                  conversationId: id,
                  ownership: { kind: "conversation" },
                  background: true,
                },
              );
            }

            request.conversationId = id;

            return summary(tx, id);
          }, context);

          return this.withConversation(value.id, context, async () => ({
            ok: true,
            value,
          }));
        }),
    );
  }

  deleteConversation(id: unknown, context: Context): Promise<Result<null>> {
    return this.perform(ConversationIdSchema, id, context, (id) =>
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
    id: unknown,
    context: Context,
  ): Promise<Result<AttachedReplicatedState<ConversationState>>> {
    return this.perform(ConversationIdSchema, id, context, (id) =>
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
    id: unknown,
    input: unknown,
    context: Context,
  ): Promise<Result<SubmissionReceipt>> {
    return this.perform(
      Type.Tuple([ConversationIdSchema, SubmitInputSchema]),
      [id, input],
      context,
      ([id, input]) =>
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

          return {
            ok: true,
            value: await submit(handle, input, context),
          };
        }),
    );
  }

  setModel(
    id: unknown,
    input: unknown,
    context: Context,
  ): Promise<Result<ModelSelectionReceipt>> {
    return this.perform(
      Type.Tuple([ConversationIdSchema, SetModelInputSchema]),
      [id, input],
      context,
      ([id, input]) =>
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
    id: unknown,
    input: unknown,
    context: Context,
  ): Promise<Result<ToolSelectionReceipt>> {
    return this.perform(
      Type.Tuple([ConversationIdSchema, SetToolsInputSchema]),
      [id, input],
      context,
      ([id, input]) =>
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
    id: unknown,
    input: unknown,
    context: Context,
  ): Promise<Result<StopReceipt>> {
    return this.perform(
      Type.Tuple([ConversationIdSchema, StopInputSchema]),
      [id, input],
      context,
      ([id, input]) =>
        this.withConversation(id, context, async (handle) => ({
          ok: true,
          value: await stop(handle, input, context),
        })),
    );
  }

  private withConversation<T>(
    id: ConversationId,
    context: Context,
    operation: (handle: pi.Conversation) => Promise<Result<T>>,
    options: { includeDeleted?: boolean } = {},
  ): Promise<Result<T>> {
    return this.admit(`conversation:${id}`, context, async () => {
      const handle = await conversation(this.harness, id, context);
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

  private async perform<S extends TSchema, T>(
    schema: S,
    input: unknown,
    context: Context,
    operation: (input: Static<S>) => Promise<Result<T>>,
  ): Promise<Result<T>> {
    context.abortSignal?.throwIfAborted();

    if (!this.available) {
      return {
        ok: false,
        error: { code: "unavailable", message: "Runtime is unavailable." },
      };
    }

    if (!Check(schema, input)) {
      return {
        ok: false,
        error: { code: "invalid_input", message: "Invalid runtime input." },
      };
    }

    try {
      return await operation(input);
    } catch (error) {
      context.abortSignal?.throwIfAborted();

      return {
        ok: false,
        error: runtimeError(
          this.available ? error : new pi.SessionFailed(error),
        ),
      };
    }
  }
}

async function summary(
  tx: pi.Tx,
  id: pi.ConversationId,
): Promise<ConversationSummary> {
  const { title, createdAt } = parseConversationDoc(
    await tx.doc(ConversationDoc, id),
  );
  return { id, title, createdAt };
}

function parseCursor(cursor: string) {
  try {
    const value: unknown = JSON.parse(cursor);
    return Check(CursorSchema, value) ? value : null;
  } catch {
    return null;
  }
}
