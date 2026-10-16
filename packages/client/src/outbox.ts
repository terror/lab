import {
  type ConversationId,
  ConversationIdSchema,
  type ConversationSummary,
  type CreateConversationInput,
  CreateConversationInputSchema,
  type LabError,
  LabErrorSchema,
  omitUndefined,
  type Result,
  type SubmissionReceipt,
  SubmissionReceiptSchema,
  type SubmitInput,
  SubmitInputSchema,
} from "@lab/wire";
import { type Static, Type } from "typebox";
import { Check } from "typebox/value";
import type { ConversationClient } from "./conversation";
import { clientError, Store } from "./store";

const SendOperationSchema = Type.Object(
  {
    target: Type.Union([Type.Literal("new"), ConversationIdSchema]),
    creation: Type.Optional(CreateConversationInputSchema),
    conversationId: Type.Optional(ConversationIdSchema),
    input: SubmitInputSchema,
    phase: Type.Union([
      Type.Literal("creating"),
      Type.Literal("submitting"),
      Type.Literal("awaiting-observation"),
      Type.Literal("complete"),
      Type.Literal("uncertain"),
    ]),
    receipt: Type.Optional(SubmissionReceiptSchema),
    error: Type.Optional(LabErrorSchema),
  },
  { additionalProperties: false },
);

const OutboxSchema = Type.Array(SendOperationSchema, { maxItems: 64 });

export type SendOperation = Static<typeof SendOperationSchema>;

export type SendInput = Omit<SubmitInput, "requestId"> &
  (
    | { conversationId: ConversationId; creation?: never }
    | {
        conversationId?: never;
        creation: Omit<CreateConversationInput, "requestId">;
      }
  );

export type OutboxSnapshot = {
  readonly operations: readonly SendOperation[];
  readonly error: Error | undefined;
};

type Transport = {
  create: (
    input: CreateConversationInput,
  ) => Promise<Result<ConversationSummary>>;
  submit: (
    id: ConversationId,
    input: SubmitInput,
  ) => Promise<Result<SubmissionReceipt>>;
  conversation: (id: ConversationId) => ConversationClient;
};

export class Outbox {
  private loaded = false;

  private readonly key = "lab.sends.v1";
  private readonly observations = new Map<string, () => void>();
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
        operation.phase === "creating" || operation.phase === "submitting"
          ? { ...operation, phase: "uncertain" as const }
          : operation,
      );

      this.loaded = true;

      this.save(recovered);
    } catch (error) {
      this.state.set({ ...this.getSnapshot(), error: clientError(error) });
    }

    for (const operation of this.getSnapshot().operations) {
      this.observe(operation);
    }
  }

  readonly start = (input: SendInput) => {
    try {
      const operations = this.operations();
      const target = input.conversationId ?? "new";

      if (
        operations.some(
          (operation) =>
            operation.phase !== "complete" &&
            (operation.target === target ||
              (target !== "new" && operation.conversationId === target)),
        )
      ) {
        throw new Error("Resolve the previous send operation first.");
      }

      const operation: SendOperation = {
        target,
        ...(input.creation === undefined
          ? { conversationId: input.conversationId }
          : {
              creation: {
                ...structuredClone(input.creation),
                requestId: crypto.randomUUID(),
              },
            }),
        input: {
          requestId: crypto.randomUUID(),
          content: input.content,
          whenBusy: input.whenBusy,
        },
        phase: target === "new" ? "creating" : "submitting",
      };

      const retained = operations.filter(
        (operation) =>
          operation.target !== target &&
          (target === "new" || operation.conversationId !== target),
      );

      if (retained.length >= 64) {
        const completed = retained.findIndex(
          (operation) =>
            operation.phase === "complete" && operation.error === undefined,
        );

        if (completed !== -1) {
          retained.splice(completed, 1);
        }
      }

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

      this.run(operation.input.requestId);
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

    if (operation?.conversationId === undefined) {
      return;
    }

    try {
      this.update(requestId, { target: operation.conversationId });
    } catch {}
  };

  forget(conversationId: ConversationId) {
    const operations = this.getSnapshot().operations;

    for (const operation of operations) {
      if (operation.conversationId === conversationId) {
        this.unobserve(operation.input.requestId);
      }
    }

    try {
      this.save(
        operations.filter(
          (operation) => operation.conversationId !== conversationId,
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
      (operation) => operation.input.requestId === requestId,
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

    if (operation === undefined || operation.phase === "complete") {
      return;
    }

    if (operation.receipt !== undefined) {
      const next = this.update(requestId, {
        phase: "awaiting-observation",
        error: undefined,
      });

      if (next !== undefined) {
        this.observe(next);
      }

      return;
    }

    if (operation.conversationId === undefined) {
      if (operation.creation === undefined) {
        throw new Error("The send operation has no conversation.");
      }

      this.update(requestId, { phase: "creating", error: undefined });

      const result = await this.transport.create(operation.creation);

      if (!result.ok) {
        this.reject(requestId, result.error);
        return;
      }

      this.update(requestId, {
        conversationId: result.value.id,
        phase: "submitting",
      });
    }

    const next = this.update(requestId, {
      phase: "submitting",
      error: undefined,
    });

    if (next?.conversationId === undefined) {
      return;
    }

    const result = await this.transport.submit(next.conversationId, next.input);

    if (!result.ok) {
      this.reject(requestId, result.error);
      return;
    }

    const submitted = this.update(requestId, {
      phase: "awaiting-observation",
      receipt: result.value,
    });

    if (submitted !== undefined) {
      this.observe(submitted);
    }
  }

  private reject(requestId: string, error: LabError) {
    this.update(requestId, {
      phase:
        error.code === "internal" || error.code === "unavailable"
          ? "uncertain"
          : "complete",
      error,
    });
  }

  private fail(requestId: string, error: unknown) {
    try {
      this.update(requestId, {
        phase: "uncertain",
        error: { code: "unavailable", message: clientError(error).message },
      });
    } catch {}
  }

  private observe(operation: SendOperation) {
    const { receipt } = operation;
    const requestId = operation.input.requestId;

    if (
      receipt === undefined ||
      operation.phase !== "awaiting-observation" ||
      this.observations.has(requestId)
    ) {
      return;
    }

    const conversation = this.transport.conversation(receipt.conversationId);

    const update = () => {
      if (!this.observations.has(requestId)) {
        return;
      }

      const { value, stale } = conversation.getSnapshot();

      if (
        (!stale &&
          value?.submissions.some(({ id }) => id === receipt.submissionId)) ||
        value?.error?.code === "not_found"
      ) {
        this.unobserve(requestId);

        try {
          this.update(requestId, {
            phase: "complete",
            error: value?.error?.code === "not_found" ? value.error : undefined,
          });
        } catch {}
      }
    };

    this.observations.set(
      requestId,
      conversation.subscribe(() => queueMicrotask(update)),
    );

    update();
  }

  private unobserve(requestId: string) {
    const unsubscribe = this.observations.get(requestId);
    this.observations.delete(requestId);
    unsubscribe?.();
  }

  private update(
    requestId: string,
    changes: Partial<Omit<SendOperation, "error">> & {
      error?: LabError | undefined;
    },
  ) {
    const operation = this.find(requestId);

    if (operation === undefined) {
      return undefined;
    }

    const next = omitUndefined({ ...operation, ...changes });

    this.save(
      this.getSnapshot().operations.map((operation) =>
        operation.input.requestId === requestId ? next : operation,
      ),
    );

    return next;
  }

  private save(operations: readonly SendOperation[]) {
    try {
      this.storage().setItem(this.key, JSON.stringify(operations));
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

function valid(operations: readonly SendOperation[]) {
  const requests = operations.flatMap(({ input, creation }) =>
    creation === undefined
      ? [input.requestId]
      : [input.requestId, creation.requestId],
  );

  const conversations = operations
    .map(({ conversationId }) => conversationId)
    .filter((id) => id !== undefined);

  const targets = operations.map(({ target }) => target);

  return (
    unique(requests) &&
    unique(conversations) &&
    unique(targets) &&
    operations.every(validOperation)
  );
}

function unique<T>(values: readonly T[]) {
  return new Set(values).size === values.length;
}

function validOperation(operation: SendOperation) {
  const { target, conversationId, creation, input, phase, receipt, error } =
    operation;

  if (target !== "new" && target !== conversationId) {
    return false;
  }

  if (conversationId === undefined && creation === undefined) {
    return false;
  }

  if (
    receipt !== undefined &&
    (receipt.conversationId !== conversationId ||
      receipt.requestId !== input.requestId)
  ) {
    return false;
  }

  switch (phase) {
    case "creating":
      return conversationId === undefined && receipt === undefined;
    case "submitting":
      return conversationId !== undefined && receipt === undefined;
    case "awaiting-observation":
      return receipt !== undefined;
    case "complete":
      return receipt !== undefined || error !== undefined;
    case "uncertain":
      return true;
  }
}

function freeze(operations: readonly SendOperation[]) {
  for (const operation of operations) {
    if (operation.creation !== undefined) {
      if (operation.creation.model !== undefined) {
        Object.freeze(operation.creation.model);
      }

      if (operation.creation.tools !== undefined) {
        Object.freeze(operation.creation.tools);
      }

      Object.freeze(operation.creation);
    }

    if (operation.receipt !== undefined) {
      Object.freeze(operation.receipt);
    }

    if (operation.error !== undefined) {
      Object.freeze(operation.error);
    }

    Object.freeze(operation.input);
    Object.freeze(operation);
  }

  return Object.freeze(operations);
}
