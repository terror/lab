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
  type Result,
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
import { conversation, runtimeError, stop, submit } from "./pi";
import type { Runtime, RuntimeConversation } from "./runtime";
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

  constructor(
    private readonly harness: pi.Harness,
    private readonly storage: pi.Storage,
    private readonly configuration: Configuration,
    private readonly extensions: readonly pi.Extension[],
  ) {
    harness.subscribeClose(() => {
      this.available = false;
    });
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
    return this.perform(
      CreateConversationInputSchema,
      input,
      context,
      async () => {
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
            model: this.configuration.model,
            extensions: this.extensions,
          });

          (await tx.doc(ConversationDoc, id)).title = input.title;

          request.conversationId = id;

          return summary(tx, id);
        }, context);

        return { ok: true, value };
      },
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
            this.perform(SubmitInputSchema, input, context, async () => ({
              ok: true,
              value: await submit(handle, input, context),
            })),
          stop: (input, context) =>
            this.perform(StopInputSchema, input, context, async () => ({
              ok: true,
              value: await stop(handle, input, context),
            })),
        },
      };
    });
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
