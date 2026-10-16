import {
  ChordError,
  type Ctx,
  createHost,
  type Host,
  isChordError,
  type Link,
  type Ref,
} from "@earendil-works/chord";
import {
  type ConversationId,
  type ConversationPage,
  LabConversation,
  LabService,
  type ListConversationsInput,
  type ListModelsInput,
  type ModelCatalog,
  type ModelSelectionReceipt,
  type Result,
  type SetModelInput,
  type SetToolsInput,
  type StopInput,
  type StopReceipt,
  type ToolCatalog,
  type ToolSelectionReceipt,
} from "@lab/contracts";
import { ConversationClient } from "./conversation";
import { SendOperations } from "./sends";
import { clientError, Store } from "./store";
import { browserLink } from "./websocket";

export type ConnectionState = {
  readonly status:
    | "disconnected"
    | "connecting"
    | "connected"
    | "reconnecting"
    | "unauthorized"
    | "incompatible";
  readonly error?: Error;
  readonly retryAt?: number;
};

export type ClientOptions = {
  readonly storage?: Storage;
  readonly onUnauthorized?: () => void;
};

type Connection = {
  host: Host;
  controller: AbortController;
  link?: Link;
  service?: Ref<typeof LabService>;
  unsubscribe?: () => void;
  retry?: ReturnType<typeof setTimeout>;
  timeout?: ReturnType<typeof setTimeout>;
  connectedAt?: number;
  attempts: number;
  blocked: boolean;
};

export class LabClient {
  private readonly state = new Store<ConnectionState>({
    status: "disconnected",
  });
  readonly connection: Pick<
    Store<ConnectionState>,
    "getSnapshot" | "subscribe"
  > = this.state;
  readonly sends: SendOperations;
  private readonly conversations = new Set<ConversationClient>();
  private current: Connection | undefined;
  private owners = 0;

  constructor(private readonly options: ClientOptions = {}) {
    this.sends = new SendOperations(() => options.storage ?? sessionStorage, {
      create: (input) =>
        this.call(async (context) => {
          const service = await context.get(LabService, {}, { state: false });
          return service.createConversation(input, context);
        }),
      submit: (id, input) =>
        this.call(async (context) => {
          const conversation = await context.get(
            LabConversation,
            { id },
            { state: false },
          );
          return conversation.submit(input, context);
        }),
      conversation: (id) => this.conversation(id),
    });
  }

  readonly connect = () => {
    this.owners += 1;

    if (this.owners === 1) {
      this.start();
    }

    let active = true;

    return () => {
      if (active) {
        active = false;
        this.owners -= 1;

        if (this.owners === 0) {
          this.disconnect();
        }
      }
    };
  };

  conversation(id: ConversationId) {
    return new ConversationClient(this, id);
  }

  listModels(
    input: ListModelsInput = { refresh: false },
    signal?: AbortSignal,
  ): Promise<Result<ModelCatalog>> {
    return this.call(async (context) => {
      const service = await context.get(LabService, {}, { state: false });
      return service.listModels(input, context);
    }, signal);
  }

  listTools(signal?: AbortSignal): Promise<Result<ToolCatalog>> {
    return this.call(async (context) => {
      const service = await context.get(LabService, {}, { state: false });
      return service.listTools({}, context);
    }, signal);
  }

  listConversations(
    input: ListConversationsInput,
    signal?: AbortSignal,
  ): Promise<Result<ConversationPage>> {
    return this.call(async (context) => {
      const service = await context.get(LabService, {}, { state: false });
      return service.listConversations(input, context);
    }, signal);
  }

  async deleteConversation(
    id: ConversationId,
    signal?: AbortSignal,
  ): Promise<Result<null>> {
    const result = await this.call(async (context) => {
      const service = await context.get(LabService, {}, { state: false });
      return service.deleteConversation(id, context);
    }, signal);

    if (result.ok || result.error.code === "not_found") {
      this.sends.forget(id);
    }

    return result;
  }

  stop(
    id: ConversationId,
    input: StopInput,
    signal?: AbortSignal,
  ): Promise<Result<StopReceipt>> {
    return this.call(async (context) => {
      const conversation = await context.get(
        LabConversation,
        { id },
        { state: false },
      );
      return conversation.stop(input, context);
    }, signal);
  }

  setModel(
    id: ConversationId,
    input: SetModelInput,
    signal?: AbortSignal,
  ): Promise<Result<ModelSelectionReceipt>> {
    return this.call(async (context) => {
      const conversation = await context.get(
        LabConversation,
        { id },
        { state: false },
      );
      return conversation.setModel(input, context);
    }, signal);
  }

  setTools(
    id: ConversationId,
    input: SetToolsInput,
    signal?: AbortSignal,
  ): Promise<Result<ToolSelectionReceipt>> {
    return this.call(async (context) => {
      const conversation = await context.get(
        LabConversation,
        { id },
        { state: false },
      );
      return conversation.setTools(input, context);
    }, signal);
  }

  watch(conversation: ConversationClient) {
    this.conversations.add(conversation);

    if (
      this.current !== undefined &&
      this.current.link !== undefined &&
      !this.current.link.closed &&
      this.connection.getSnapshot().status === "connected"
    ) {
      conversation.attach(this.current.host);
    }

    return () => {
      this.conversations.delete(conversation);
      conversation.detach();
    };
  }

  referenceFailed(error: unknown) {
    const current = this.current;

    if (current === undefined || current.blocked) {
      return;
    }

    if (
      isChordError(error, "contract_mismatch") ||
      isChordError(error, "upgrade_required")
    ) {
      this.block(current, "incompatible", clientError(error));
    } else if (
      isChordError(error, "forbidden") ||
      isChordError(error, "unavailable") ||
      isChordError(error, "superseded") ||
      isChordError(error, "upgrade_conflict")
    ) {
      this.failed(current, clientError(error));
    }
  }

  private start() {
    this.sends.load();

    const current: Connection = {
      host: createHost({
        kind: "client",
        self: "browser",
        readyTimeout: 15_000,
      }),
      controller: new AbortController(),
      attempts: 0,
      blocked: false,
    };

    this.current = current;
    this.state.set({ status: "connecting" });

    void this.open(current);
  }

  private disconnect() {
    const current = this.current;
    this.current = undefined;

    if (current === undefined) {
      return;
    }

    clearTimeout(current.retry);
    clearTimeout(current.timeout);
    current.unsubscribe?.();
    current.service?.release();
    current.controller.abort();

    for (const conversation of this.conversations) {
      conversation.detach();
    }

    current.link?.close();
    void current.host.close().catch((error) => {
      if (this.current === undefined) {
        this.state.set({
          status: "disconnected",
          error: clientError(error),
        });
      }
    });
    this.state.set({ status: "disconnected" });
  }

  private async open(current: Connection) {
    current.retry = undefined;

    try {
      const response = await fetch("/auth/session", {
        credentials: "same-origin",
        cache: "no-store",
        headers: { "X-Lab-Request": "1" },
        signal: AbortSignal.any([
          current.controller.signal,
          AbortSignal.timeout(15_000),
        ]),
      });

      if (this.current !== current || current.blocked) {
        return;
      }

      if (response.status === 401 || response.status === 403) {
        this.block(current, "unauthorized", new Error("Sign in to reconnect."));
        return;
      }

      if (response.status !== 204) {
        throw new Error("Unable to reach your session.");
      }

      const url = new URL("/chord", location.href);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      const link = browserLink(url);
      current.link = link;
      current.timeout = setTimeout(
        () => link.close("Connection timed out"),
        15_000,
      );

      current.host.connect(link, {
        principal: "server",
        onProtocolMismatch: () =>
          this.block(
            current,
            "incompatible",
            new Error("lab was updated. Reload this page to reconnect."),
          ),
      });

      link.onClose((reason) => {
        if (this.current !== current || current.link !== link) {
          return;
        }

        current.link = undefined;
        clearTimeout(current.timeout);
        current.unsubscribe?.();
        current.unsubscribe = undefined;
        current.service?.release();
        current.service = undefined;

        if (!current.blocked) {
          this.schedule(current, new Error(reason));
        }
      });

      if (link.closed) {
        return;
      }

      const service = current.host.hold(LabService, {});
      current.service = service;
      const update = () => {
        if (this.current !== current || current.service !== service) {
          return;
        }

        if (service.status === "live") {
          clearTimeout(current.timeout);
          current.connectedAt = Date.now();
          this.state.set({ status: "connected" });

          for (const conversation of this.conversations) {
            conversation.attach(current.host);
          }
        } else if (service.status === "gone") {
          this.referenceFailed(service.error);

          if (!current.blocked) {
            this.failed(current, clientError(service.error));
          }
        }
      };

      current.unsubscribe = service.onStatus(update);
      update();
    } catch (error) {
      if (this.current === current && !current.blocked) {
        this.failed(current, clientError(error));
      }
    }
  }

  private failed(current: Connection, error: Error) {
    if (current.link !== undefined) {
      current.link.close(error.message);
    } else {
      this.schedule(current, error);
    }
  }

  private schedule(current: Connection, error: Error) {
    if (current.retry !== undefined || current.blocked) {
      return;
    }

    if (
      current.connectedAt !== undefined &&
      Date.now() - current.connectedAt >= 30_000
    ) {
      current.attempts = 0;
    }

    current.connectedAt = undefined;
    const delay =
      Math.min(30_000, 500 * 2 ** Math.min(current.attempts, 6)) *
      (0.5 + Math.random() * 0.5);
    current.attempts = Math.min(current.attempts + 1, 6);
    this.state.set({
      status: "reconnecting",
      error,
      retryAt: Date.now() + delay,
    });
    current.retry = setTimeout(() => void this.open(current), delay);
  }

  private block(
    current: Connection,
    status: "unauthorized" | "incompatible",
    error: Error,
  ) {
    if (this.current !== current || current.blocked) {
      return;
    }

    current.blocked = true;
    clearTimeout(current.retry);
    clearTimeout(current.timeout);
    current.link?.close(error.message);
    this.state.set({ status, error });

    if (status === "unauthorized") {
      this.options.onUnauthorized?.();
    }
  }

  private async call<T>(
    operation: (context: Ctx) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    const current = this.current;

    if (
      current === undefined ||
      this.connection.getSnapshot().status !== "connected"
    ) {
      throw new ChordError("unavailable", "lab is not connected.");
    }

    try {
      return await current.host.root(operation, {
        signal: AbortSignal.any([
          current.controller.signal,
          AbortSignal.timeout(30_000),
          ...(signal === undefined ? [] : [signal]),
        ]),
      });
    } catch (error) {
      if (this.current === current) {
        this.referenceFailed(error);
      }

      throw error;
    }
  }
}
