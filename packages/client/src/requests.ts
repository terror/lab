import {
  type ConversationId,
  ConversationIdSchema,
  type CreateConversationInput,
  CreateConversationInputSchema,
  type SubmitInput,
  SubmitInputSchema,
} from "@lab/contracts";
import { type Static, Type } from "typebox";
import { Check } from "typebox/value";
import { clientError, Store } from "./store";

const PendingRequestSchema = Type.Union([
  Type.Object(
    {
      kind: Type.Literal("create"),
      input: CreateConversationInputSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("submit"),
      conversationId: ConversationIdSchema,
      input: SubmitInputSchema,
    },
    { additionalProperties: false },
  ),
]);

const PendingRequestsSchema = Type.Array(PendingRequestSchema, {
  maxItems: 64,
});

export type PendingRequest = Static<typeof PendingRequestSchema>;

export type PendingRequestsState = {
  readonly requests: readonly PendingRequest[];
  readonly error: Error | undefined;
};

export class RequestJournal extends Store<PendingRequestsState> {
  private loaded = false;
  private readonly key = "lab.pending-requests.v1";

  constructor(private readonly storage: () => Storage) {
    super({ requests: [], error: undefined });
  }

  load() {
    try {
      const stored = this.storage().getItem(this.key);
      const requests: unknown = stored === null ? [] : JSON.parse(stored);

      if (
        !Check(PendingRequestsSchema, requests) ||
        new Set(requests.map((request) => request.input.requestId)).size !==
          requests.length ||
        new Set(requests.map(requestKey)).size !== requests.length
      ) {
        throw new Error("Saved admission requests are invalid.");
      }

      this.loaded = true;
      this.set({ requests: freeze(requests), error: undefined });
    } catch (error) {
      this.set({ ...this.getSnapshot(), error: clientError(error) });
    }
  }

  create(input: Omit<CreateConversationInput, "requestId">) {
    const pending = this.creation();

    if (pending !== undefined) {
      if (pending.input.title !== input.title) {
        throw new Error("Retry the unresolved conversation creation first.");
      }

      return pending;
    }

    return this.add({
      kind: "create",
      input: { requestId: crypto.randomUUID(), title: input.title },
    });
  }

  submit(
    conversationId: ConversationId,
    input: Omit<SubmitInput, "requestId">,
  ) {
    const pending = this.submission(conversationId);

    if (pending !== undefined) {
      if (
        pending.input.content !== input.content ||
        pending.input.whenBusy !== input.whenBusy
      ) {
        throw new Error("Retry the unresolved submission first.");
      }

      return pending;
    }

    return this.add({
      kind: "submit",
      conversationId,
      input: {
        requestId: crypto.randomUUID(),
        content: input.content,
        whenBusy: input.whenBusy,
      },
    });
  }

  creation() {
    return this.requests().find((request) => request.kind === "create");
  }

  submission(conversationId: ConversationId) {
    return this.requests().find(
      (request): request is Extract<PendingRequest, { kind: "submit" }> =>
        request.kind === "submit" && request.conversationId === conversationId,
    );
  }

  complete(requestId: string) {
    try {
      this.save(
        this.getSnapshot().requests.filter(
          (request) => request.input.requestId !== requestId,
        ),
      );
    } catch (error) {
      this.set({ ...this.getSnapshot(), error: clientError(error) });
    }
  }

  private requests() {
    if (!this.loaded || this.getSnapshot().error !== undefined) {
      this.load();
    }

    const { requests, error } = this.getSnapshot();

    if (error !== undefined) {
      throw error;
    }

    return requests;
  }

  private add<T extends PendingRequest>(request: T): T {
    const requests = [...this.requests(), request];

    if (!Check(PendingRequestsSchema, requests)) {
      throw new Error(
        "Invalid admission request or too many pending requests.",
      );
    }

    this.save(requests);
    return request;
  }

  private save(requests: readonly PendingRequest[]) {
    if (requests.length === 0) {
      this.storage().removeItem(this.key);
    } else {
      this.storage().setItem(this.key, JSON.stringify(requests));
    }

    this.set({ requests: freeze(requests), error: undefined });
  }
}

function requestKey(request: PendingRequest) {
  return request.kind === "create"
    ? "create"
    : `submit:${request.conversationId}`;
}

function freeze(requests: readonly PendingRequest[]) {
  for (const request of requests) {
    Object.freeze(request.input);
    Object.freeze(request);
  }

  return Object.freeze(requests);
}
