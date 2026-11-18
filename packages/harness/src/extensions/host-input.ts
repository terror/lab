import { type Context, awaitWithContext } from '@earendil-works/chord/context';
import type {
  DocumentWatch,
  JsonObject,
  ToolExecutionApi,
} from '@earendil-works/pi-durable';

import { conversationDoc } from './docs';

export const ANSWER_LENGTH = 1_000;

export const APPROVED = 'approved';

export const DENIED = 'denied';

type Answers = {
  answers: Record<string, string>;
  asked?: Record<string, number>;
};

export const QuestionsDoc = conversationDoc<Answers>('lab.questions', () => ({
  answers: {},
}));

function answerFor(watch: DocumentWatch<Answers>, callId: string) {
  return new Promise<string>((resolve) => {
    const existing = watch.value.answers[callId];

    if (existing !== undefined) {
      resolve(existing);
      return;
    }

    watch.start(async (call) => {
      const answer =
        call.kind === 'value' ? call.value.answers[callId] : undefined;

      if (answer !== undefined) {
        resolve(answer);
      }
    });
  });
}

export async function waitForAnswer(
  api: ToolExecutionApi,
  context: Context,
  details: JsonObject
): Promise<string | undefined> {
  await api.commit(async (tx) => {
    const doc = await tx.doc(QuestionsDoc, api.conversationId);

    const asked = doc.asked?.[api.callId];

    if (asked !== undefined && asked !== api.taskId) {
      delete doc.answers[api.callId];
    }

    doc.asked ??= {};
    doc.asked[api.callId] = api.taskId;
  }, context);

  await api.details(details, context);

  const watch = await api.watchDoc(QuestionsDoc, api.conversationId, context);

  if (!watch) {
    return undefined;
  }

  try {
    return await awaitWithContext(answerFor(watch, api.callId), context);
  } finally {
    await watch.stop();
  }
}

export type ApprovalRequest = { action: string; summary: string[] };

export async function requestApproval(
  api: ToolExecutionApi,
  context: Context,
  request: ApprovalRequest
) {
  const answer = await waitForAnswer(api, context, { approval: request });

  const approval = {
    ...request,
    decision: answer === APPROVED ? APPROVED : DENIED,
  };

  await api.details({ approval }, context);

  return { approval, approved: answer === APPROVED };
}
