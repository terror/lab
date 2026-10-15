import type { Context } from "@earendil-works/chord";
import * as pi from "@earendil-works/pi-durable";
import {
  type ConversationId,
  ConversationIdSchema,
  type ConversationPage,
  type ConversationSummary,
  type CreateConversationInput,
  CreateConversationInputSchema,
  type ListConversationsInput,
  ListConversationsInputSchema,
  type ListModelsInput,
  ListModelsInputSchema,
  type ModelCatalog,
  type Result,
  SetModelInputSchema,
  StopInputSchema,
  SubmitInputSchema,
} from "@lab/contracts";
import { type TSchema, Type } from "typebox";
import { Check } from "typebox/value";
import {
  type Configuration,
  ConversationDoc,
  CreationRequestDoc,
} from "./metadata";
import type { ModelRegistry } from "./models";
import { conversation, runtimeError, stop, submit } from "./pi";
import type { Runtime, RuntimeConversation } from "./runtime";
import { TitleTask, UNTITLED_CONVERSATION } from "./titles";
import { ConversationObservation } from "./view";

const CursorSchema = Type.Object(
  {
    after: ConversationIdSchema,
    order: Type.Literal("descending"),
  },
  { additionalProperties: false },
);

export class HarnessRuntime implements Runtime {
  private available = true;
  private readonly admissions = new Map<string, Promise<void>>();

  constructor(
    private readonly harness: pi.Harness,
    private readonly storage: pi.Storage,
    private readonly configuration: Configuration,
    private readonly extensions: readonly pi.Extension[],
    private readonly models: ModelRegistry,
  ) {
    harness.subscribeClose(() => {
      this.available = false;
    });
  }

  listModels(
    input: ListModelsInput,
    context: Context,
  ): Promise<Result<ModelCatalog>> {
    return this.perform(ListModelsInputSchema, input, context, async () => ({
      ok: true,
      value: await this.models.list(this.configuration.model, input, context),
    }));
  }

  listConversations(
    input: ListConversationsInput,
    context: Context,
  ): Promise<Result<ConversationPage>> {
    return this.perform(
      ListConversationsInputSchema,
      input,
      context,
      async () => {
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
          const page = await tx.scanConversations(
            { order: "descending" },
            input.limit,
            cursor,
          );

          const items = await Promise.all(
            page.items.map(({ id }) => summary(tx, id)),
          );

          return {
            items,
            ...(page.next === undefined
              ? {}
              : { next: JSON.stringify(page.next) }),
          };
        }, context);

        return { ok: true, value: page };
      },
    );
  }

  createConversation(
    input: CreateConversationInput,
    context: Context,
  ): Promise<Result<ConversationSummary>> {
    return this.perform(CreateConversationInputSchema, input, context, () =>
      this.admit(`create:${input.requestId}`, context, async () => {
        const request = await this.harness.snapshot(
          CreationRequestDoc,
          input.requestId,
          context,
        );

        if (request?.conversationId != null) {
          return {
            ok: true,
            value: await this.harness.commit(
              (tx) => summary(tx, request.conversationId as pi.ConversationId),
              context,
            ),
          };
        }

        const model = await this.models.validate(
          input.model ?? this.configuration.model,
          context,
        );

        if (!model.ok) {
          return model;
        }

        const value = await this.harness.commit(async (tx) => {
          const request = await tx.doc(
            CreationRequestDoc,
            input.requestId,
            null,
          );

          if (request.conversationId !== null) {
            return summary(tx, request.conversationId as pi.ConversationId);
          }

          const { id } = await tx.createConversation({
            ownership: { kind: "ownerless" },
          });

          await pi.configure(tx, id, {
            model: model.value,
            extensions: this.extensions,
          });

          (await tx.doc(ConversationDoc, id)).title = input.title;

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

        return { ok: true, value };
      }),
    );
  }

  conversation(
    id: ConversationId,
    context: Context,
  ): Promise<Result<RuntimeConversation>> {
    return this.perform(ConversationIdSchema, id, context, async () => {
      const handle = await conversation(this.harness, id, context);

      if (handle === undefined) {
        return {
          ok: false,
          error: { code: "not_found", message: "Conversation not found." },
        };
      }

      return {
        ok: true,
        value: {
          id: handle.id,
          observe: (context) =>
            this.perform(ConversationIdSchema, id, context, async () => ({
              ok: true,
              value: await ConversationObservation.open(
                this.harness,
                this.storage,
                handle,
                context,
              ),
            })),
          submit: (input, context) =>
            this.perform(SubmitInputSchema, input, context, () =>
              this.admit(
                `submit:${id}:${input.requestId}`,
                context,
                async () => {
                  const existing = await this.harness.commit(
                    (tx) => tx.submissionByRequest(handle.id, input.requestId),
                    context,
                  );

                  if (existing === undefined) {
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
                },
              ),
            ),
          setModel: (input, context) =>
            this.perform(SetModelInputSchema, input, context, async () => {
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
          stop: (input, context) =>
            this.perform(StopInputSchema, input, context, async () => ({
              ok: true,
              value: await stop(handle, input, context),
            })),
        },
      };
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
    schema: TSchema,
    input: unknown,
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

    if (!Check(schema, input)) {
      return {
        ok: false,
        error: { code: "invalid_input", message: "Invalid runtime input." },
      };
    }

    try {
      return await operation();
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
  const { title, createdAt } = await tx.doc(ConversationDoc, id);
  return { id, title, createdAt };
}

function parseCursor(cursor: string) {
  try {
    const value = JSON.parse(cursor) as unknown;
    return Check(CursorSchema, value) ? value : null;
  } catch {
    return null;
  }
}
