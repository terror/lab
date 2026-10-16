import type { Context } from "@earendil-works/chord";
import * as pi from "@earendil-works/pi-durable";
import { SqliteStorage } from "@earendil-works/pi-durable/storage/sqlite";
import {
  type ConversationId,
  type LabError,
  omitUndefined,
  type StopInput,
  type StopReceipt,
  type SubmissionReceipt,
  type SubmissionState,
  type SubmitInput,
} from "@lab/contracts";
import { BunSqliteDatabase } from "./sqlite";

export async function openStorage(path: string) {
  return SqliteStorage.open(
    await BunSqliteDatabase.open(path, { exclusive: true }),
  );
}

export function openHarness(
  storage: pi.Storage,
  options: pi.HarnessOptions,
  context: Context,
) {
  return pi.Harness.open(storage, options, context);
}

export function listConversations(
  harness: pi.Harness,
  limit: number,
  cursor: pi.Cursor | undefined,
  context: Context,
) {
  return harness.commit(
    (tx) => tx.scanConversations({ order: "descending" }, limit, cursor),
    context,
  );
}

export function createConversation(
  harness: pi.Harness,
  options: Omit<pi.ConversationCreateOptions, "ownership">,
  context: Context,
) {
  return harness.createConversation(
    { ...options, ownership: { kind: "ownerless" } },
    context,
  );
}

export function conversation(
  harness: pi.Harness,
  id: ConversationId,
  context: Context,
) {
  return harness.conversation(id as pi.ConversationId, context);
}

export async function submit(
  conversation: pi.Conversation,
  input: SubmitInput,
  context: Context,
): Promise<SubmissionReceipt> {
  const submission = await conversation.submit(
    {
      type: "input",
      content: input.content,
      requestId: input.requestId,
      whenBusy: input.whenBusy,
    },
    context,
  );

  return {
    conversationId: conversation.id,
    submissionId: submission.id,
    requestId: input.requestId,
    status: "admitted",
  };
}

export async function stop(
  conversation: pi.Conversation,
  input: StopInput,
  context: Context,
): Promise<StopReceipt> {
  await conversation.abort(context, { background: input.scope === "all" });

  return {
    conversationId: conversation.id,
    scope: input.scope,
    status: "stopped",
  };
}

export function observe(conversation: pi.Conversation, context: Context) {
  return conversation.viewState(context);
}

export function submissionState(
  record: Extract<pi.SubmissionRecord, { type: "input" }>,
): SubmissionState {
  switch (record.status) {
    case "queued":
      return { id: record.id, status: record.status };
    case "placed":
      return { id: record.id, status: record.status, entryId: record.entry };
    case "done":
      return {
        id: record.id,
        status: record.status,
        entryId: record.entry,
        answerId: record.answer,
      };
    case "unanswered":
      return {
        id: record.id,
        status: record.status,
        reason: record.reason,
        ...omitUndefined({ entryId: record.entry }),
      };
  }
}

export function runtimeError(error: unknown): LabError {
  if (error instanceof pi.ConversationBusy) {
    return { code: "busy", message: "Conversation is busy." };
  }

  if (error instanceof pi.SessionFailed) {
    return { code: "unavailable", message: "Runtime is unavailable." };
  }

  if (error instanceof pi.StorageRequestError) {
    return { code: "invalid_input", message: "Invalid runtime request." };
  }

  return { code: "internal", message: "Runtime operation failed." };
}
