import {
  type ConversationId,
  type ConversationPage,
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
} from "@lab/wire";
import { Connection } from "./connection";
import { ConversationClient } from "./conversation";
import { Outbox } from "./outbox";

export type ClientOptions = {
  readonly storage?: Storage;
  readonly onUnauthorized?: () => void;
};

export class LabClient {
  private readonly transport: Connection;

  readonly connection: Pick<Connection, "getSnapshot" | "subscribe">;
  readonly outbox: Outbox;

  constructor(options: ClientOptions = {}) {
    this.transport = new Connection(options.onUnauthorized);

    this.connection = this.transport;

    this.outbox = new Outbox(() => options.storage ?? sessionStorage, {
      start: (input) =>
        this.transport.call(async (context) => {
          const service = await context.get(LabService, {}, { state: false });
          return service.startConversation(input, context);
        }),
      submit: (id, input) =>
        this.transport.call(async (context) => {
          const service = await context.get(LabService, {}, { state: false });
          return service.submit({ id, input }, context);
        }),
    });
  }

  readonly connect = () => {
    this.outbox.load();
    return this.transport.connect();
  };

  conversation(id: ConversationId) {
    return new ConversationClient(this, id);
  }

  listModels(
    input: ListModelsInput = { refresh: false },
    signal?: AbortSignal,
  ): Promise<Result<ModelCatalog>> {
    return this.transport.call(async (context) => {
      const service = await context.get(LabService, {}, { state: false });
      return service.listModels(input, context);
    }, signal);
  }

  listTools(signal?: AbortSignal): Promise<Result<ToolCatalog>> {
    return this.transport.call(async (context) => {
      const service = await context.get(LabService, {}, { state: false });
      return service.listTools({}, context);
    }, signal);
  }

  listConversations(
    input: ListConversationsInput,
    signal?: AbortSignal,
  ): Promise<Result<ConversationPage>> {
    return this.transport.call(async (context) => {
      const service = await context.get(LabService, {}, { state: false });
      return service.listConversations(input, context);
    }, signal);
  }

  subscribeConversations(listener: () => void) {
    return this.transport.subscribeConversations(listener);
  }

  async deleteConversation(
    id: ConversationId,
    signal?: AbortSignal,
  ): Promise<Result<null>> {
    const result = await this.transport.call(async (context) => {
      const service = await context.get(LabService, {}, { state: false });
      return service.deleteConversation(id, context);
    }, signal);

    if (result.ok || result.error.code === "not_found") {
      this.outbox.forget(id);
    }

    return result;
  }

  stop(
    id: ConversationId,
    input: StopInput,
    signal?: AbortSignal,
  ): Promise<Result<StopReceipt>> {
    return this.transport.call(async (context) => {
      const service = await context.get(LabService, {}, { state: false });
      return service.stop({ id, input }, context);
    }, signal);
  }

  setModel(
    id: ConversationId,
    input: SetModelInput,
    signal?: AbortSignal,
  ): Promise<Result<ModelSelectionReceipt>> {
    return this.transport.call(async (context) => {
      const service = await context.get(LabService, {}, { state: false });
      return service.setModel({ id, input }, context);
    }, signal);
  }

  setTools(
    id: ConversationId,
    input: SetToolsInput,
    signal?: AbortSignal,
  ): Promise<Result<ToolSelectionReceipt>> {
    return this.transport.call(async (context) => {
      const service = await context.get(LabService, {}, { state: false });
      return service.setTools({ id, input }, context);
    }, signal);
  }

  watch(conversation: ConversationClient) {
    return this.transport.watch(conversation);
  }
}
