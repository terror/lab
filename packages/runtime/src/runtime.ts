import type {
  AttachedReplicatedState,
  Context,
  Ctx,
} from "@earendil-works/chord";
import {
  BACKGROUND_CONTEXT,
  withAbortSignal,
} from "@earendil-works/chord/context";
import type {
  ConversationId,
  ConversationPage,
  ConversationState,
  ConversationSummary,
  CreateConversationInput,
  ListConversationsInput,
  ListModelsInput,
  ModelCatalog,
  ModelSelectionReceipt,
  Result,
  SetModelInput,
  SetToolsInput,
  StopInput,
  StopReceipt,
  SubmissionReceipt,
  SubmitInput,
  ToolCatalog,
  ToolSelectionReceipt,
} from "@lab/contracts";

export interface Runtime {
  listTools(context: Context): Promise<Result<ToolCatalog>>;
  listModels(
    input: ListModelsInput,
    context: Context,
  ): Promise<Result<ModelCatalog>>;
  listConversations(
    input: ListConversationsInput,
    context: Context,
  ): Promise<Result<ConversationPage>>;
  createConversation(
    input: CreateConversationInput,
    context: Context,
  ): Promise<Result<ConversationSummary>>;
  deleteConversation(
    id: ConversationId,
    context: Context,
  ): Promise<Result<null>>;
  observeConversation(
    id: ConversationId,
    context: Context,
  ): Promise<Result<AttachedReplicatedState<ConversationState>>>;
  submit(
    id: ConversationId,
    input: SubmitInput,
    context: Context,
  ): Promise<Result<SubmissionReceipt>>;
  setModel(
    id: ConversationId,
    input: SetModelInput,
    context: Context,
  ): Promise<Result<ModelSelectionReceipt>>;
  setTools(
    id: ConversationId,
    input: SetToolsInput,
    context: Context,
  ): Promise<Result<ToolSelectionReceipt>>;
  stop(
    id: ConversationId,
    input: StopInput,
    context: Context,
  ): Promise<Result<StopReceipt>>;
}

export interface RuntimeOwner {
  readonly runtime: Runtime;
  readonly closed: Promise<RuntimeEnd>;
  close(context: Context): Promise<void>;
}

export type RuntimeEnd =
  | { reason: "closed" }
  | { reason: "failed"; error: unknown };

export function callContext(context: Ctx): Context {
  return withAbortSignal(context.signal, BACKGROUND_CONTEXT);
}
