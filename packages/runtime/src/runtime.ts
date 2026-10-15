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
  Result,
  StopInput,
  StopReceipt,
  SubmissionReceipt,
  SubmitInput,
} from "@lab/contracts";

export interface RuntimeConversation {
  readonly id: ConversationId;
  submit(
    input: SubmitInput,
    context: Context,
  ): Promise<Result<SubmissionReceipt>>;
  stop(input: StopInput, context: Context): Promise<Result<StopReceipt>>;
  observe(
    context: Context,
  ): Promise<AttachedReplicatedState<ConversationState>>;
}

export interface Runtime {
  listConversations(
    input: ListConversationsInput,
    context: Context,
  ): Promise<Result<ConversationPage>>;
  createConversation(
    input: CreateConversationInput,
    context: Context,
  ): Promise<Result<ConversationSummary>>;
  conversation(
    id: ConversationId,
    context: Context,
  ): Promise<Result<RuntimeConversation>>;
}

export interface RuntimeOwner {
  readonly runtime: Runtime;
  close(context: Context): Promise<void>;
}

export function callContext(context: Ctx): Context {
  return withAbortSignal(context.signal, BACKGROUND_CONTEXT);
}
