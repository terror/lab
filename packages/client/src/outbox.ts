import {
  type ConversationId,
  ConversationIdSchema,
  type LabError,
  LabErrorSchema,
  type Result,
  type StartConversationInput,
  StartConversationInputSchema,
  type SubmissionReceipt,
  type SubmitInput,
  SubmitInputSchema,
} from "@lab/wire";
import { type Static, type TProperties, Type } from "typebox";
import { Check } from "typebox/value";
import { clientError, Store } from "./store";

const SendOperationSchema = Type.Union([
  sendOperationSchema({ phase: Type.Literal("submitting") }),
  sendOperationSchema({
    phase: Type.Literal("rejected"),
    error: LabErrorSchema,
  }),
  sendOperationSchema({
    phase: Type.Literal("uncertain"),
    error: Type.Optional(LabErrorSchema),
  }),
  Type.Object(
    {
      requestId: SubmitInputSchema.properties.requestId,
      target: Type.Literal("new"),
      phase: Type.Literal("complete"),
      conversationId: ConversationIdSchema,
    },
    { additionalProperties: false },
  ),
]);

const OutboxSchema = Type.Array(SendOperationSchema, { maxItems: 64 });

export type SendOperation = Static<typeof SendOperationSchema>;

export type SendInput = Omit<SubmitInput, "requestId"> &
  (
    | { conversationId: ConversationId; creation?: never }
    | {
        conversationId?: never;
        creation: Omit<StartConversationInput, "requestId" | "content">;
      }
  );

export type OutboxSnapshot = {
  readonly operations: readonly SendOperation[];
  readonly error: Error | undefined;
};

type Transport = {
  start: (input: StartConversationInput) => Promise<Result<SubmissionReceipt>>;
  submit: (
    id: ConversationId,
    input: SubmitInput,
  ) => Promise<Result<SubmissionReceipt>>;
};

export class Outbox {
  private loaded = false;

  private readonly key = "lab.sends.v3";
  private readonly running = new Set<string>();
  private readonly state = new Store<OutboxSnapshot>({
    operations: [],
    error: undefined,
  });

  constructor(
    private readonly storage: () => Storage,
    private readonly transport: Transport,
  ) {}

  readonly getSnapshot = this.state.getSnapshot;
  readonly subscribe = this.state.subscribe;

  load() {
    if (this.loaded) {
      return;
    }

    try {
      const storage = this.storage();
      const stored = storage.getItem(this.key);

      const operations: unknown = stored === null ? [] : JSON.parse(stored);

      if (!Check(OutboxSchema, operations) || !valid(operations)) {
        throw new Error("Saved send operations are invalid.");
      }

      const recovered = operations.map((operation) =>
        operation.phase === "submitting"
          ? { ...operation, phase: "uncertain" as const }
          : operation,
      );

      this.loaded = true;

      this.save(recovered);
    } catch (error) {
      this.state.set({ ...this.getSnapshot(), error: clientError(error) });
    }
  }

  readonly start = (input: SendInput) => {
    try {
      const operations = this.operations();
      const target = input.conversationId ?? "new";

      if (
        operations.some(
          (operation) =>
            operation.phase !== "rejected" && operation.target === target,
        )
      ) {
        throw new Error("Resolve the previous send operation first.");
      }

      const operation: SendOperation = {
        requestId: crypto.randomUUID(),
        ...(input.creation === undefined
          ? { target: input.conversationId }
          : {
              target: "new" as const,
              creation: structuredClone(input.creation),
            }),
        input: {
          content: input.content,
          whenBusy: input.whenBusy,
        },
        phase: "submitting",
      };

      const retained = operations.filter(
        (operation) => operation.target !== target,
      );

      const next = [...retained, operation];

      if (!Check(OutboxSchema, next) || !valid(next)) {
        throw new Error("Invalid message or too many saved send operations.");
      }

      try {
        this.save(next);
      } catch (error) {
        this.state.set({ operations, error: clientError(error) });
        return undefined;
      }

      this.run(operation.requestId);
      return operation;
    } catch (error) {
      this.state.set({ ...this.getSnapshot(), error: clientError(error) });
      return undefined;
    }
  };

  readonly retry = (requestId: string) => {
    this.run(requestId);
  };

  readonly acknowledge = (requestId: string) => {
    const operation = this.find(requestId);

    if (operation?.phase !== "complete") {
      return;
    }

    try {
      this.remove(requestId);
    } catch {}
  };

  forget(conversationId: ConversationId) {
    const operations = this.getSnapshot().operations;

    try {
      this.save(
        operations.filter(
          (operation) =>
            operation.target !== conversationId &&
            (operation.phase !== "complete" ||
              operation.conversationId !== conversationId),
        ),
      );
    } catch {}
  }

  private operations() {
    this.load();

    if (!this.loaded) {
      throw this.getSnapshot().error;
    }

    return this.getSnapshot().operations;
  }

  private find(requestId: string) {
    return this.getSnapshot().operations.find(
      (operation) => operation.requestId === requestId,
    );
  }

  private run(requestId: string) {
    if (this.running.has(requestId)) {
      return;
    }

    this.running.add(requestId);

    void Promise.resolve()
      .then(() => this.execute(requestId))
      .catch((error) => this.fail(requestId, error))
      .finally(() => this.running.delete(requestId));
  }

  private async execute(requestId: string) {
    const operation = this.find(requestId);

    if (
      operation === undefined ||
      operation.phase === "complete" ||
      operation.phase === "rejected"
    ) {
      return;
    }

    if (operation.phase === "uncertain") {
      const { error: _error, ...properties } = operation;

      this.update({ ...properties, phase: "submitting" });
    }

    const result =
      operation.target === "new"
        ? await this.transport.start({
            ...operation.creation,
            requestId: operation.requestId,
            content: operation.input.content,
          })
        : await this.transport.submit(operation.target, {
            ...operation.input,
            requestId: operation.requestId,
          });

    if (!result.ok) {
      this.reject(requestId, result.error);
      return;
    }

    if (operation.target === "new") {
      this.update({
        requestId,
        target: "new",
        conversationId: result.value.conversationId,
        phase: "complete",
      });
    } else {
      this.remove(requestId);
    }
  }

  private reject(requestId: string, error: LabError) {
    const operation = this.find(requestId);

    if (operation === undefined || operation.phase === "complete") {
      return;
    }

    this.update({
      ...operation,
      phase:
        error.code === "internal" || error.code === "unavailable"
          ? "uncertain"
          : "rejected",
      error,
    });
  }

  private fail(requestId: string, error: unknown) {
    const operation = this.find(requestId);

    if (
      operation === undefined ||
      operation.phase === "complete" ||
      operation.phase === "rejected"
    ) {
      return;
    }

    try {
      this.reject(requestId, {
        code: "unavailable",
        message: clientError(error).message,
      });
    } catch {}
  }

  private update(next: SendOperation) {
    this.save(
      this.getSnapshot().operations.map((operation) =>
        operation.requestId === next.requestId ? next : operation,
      ),
    );
  }

  private remove(requestId: string) {
    this.save(
      this.getSnapshot().operations.filter(
        (operation) => operation.requestId !== requestId,
      ),
    );
  }

  private save(operations: readonly SendOperation[]) {
    try {
      const storage = this.storage();

      if (operations.length === 0) {
        storage.removeItem(this.key);
      } else {
        storage.setItem(this.key, JSON.stringify(operations));
      }
    } catch (error) {
      this.state.set({
        operations: freeze(operations),
        error: clientError(error),
      });

      throw error;
    }

    this.state.set({ operations: freeze(operations), error: undefined });
  }
}

function sendOperationSchema<T extends TProperties>(phase: T) {
  const properties = {
    requestId: SubmitInputSchema.properties.requestId,
    input: Type.Omit(SubmitInputSchema, ["requestId"]),
    ...phase,
  };

  return Type.Union([
    Type.Object(
      {
        ...properties,
        target: ConversationIdSchema,
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        ...properties,
        target: Type.Literal("new"),
        creation: Type.Omit(StartConversationInputSchema, [
          "requestId",
          "content",
        ]),
      },
      { additionalProperties: false },
    ),
  ]);
}

function valid(operations: readonly SendOperation[]) {
  return (
    unique(operations.map(({ requestId }) => requestId)) &&
    unique(operations.map(({ target }) => target))
  );
}

function unique<T>(values: readonly T[]) {
  return new Set(values).size === values.length;
}

function freeze(operations: readonly SendOperation[]) {
  for (const operation of operations) {
    if (operation.phase !== "complete") {
      if (operation.target === "new") {
        if (operation.creation.model !== undefined) {
          Object.freeze(operation.creation.model);
        }

        if (operation.creation.tools !== undefined) {
          Object.freeze(operation.creation.tools);
        }

        Object.freeze(operation.creation);
      }

      if (operation.phase !== "submitting" && operation.error !== undefined) {
        Object.freeze(operation.error);
      }

      Object.freeze(operation.input);
    }

    Object.freeze(operation);
  }

  return Object.freeze(operations);
}
