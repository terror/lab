import { type Context, awaitWithContext } from '@earendil-works/chord/context';
import {
  type DocumentWatch,
  type ToolExecutionApi,
  defineDoc,
} from '@earendil-works/pi-durable';

export const ANSWER_LENGTH = 1_000;

export const APPROVED = 'approved';

export const DENIED = 'denied';

type Answers = { answers: Record<string, string> };

export const QuestionsDoc = defineDoc<Answers>({
  kind: 'lab.questions',
  version: 1,
  scope: 'conversation',
  history: 'latest',
  fork: 'current',
  initial: () => ({ answers: {} }),
  checkpointWhen: () => true,
});

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
  context: Context
): Promise<string | undefined> {
  await api.commit(async (tx) => {
    await tx.doc(QuestionsDoc, api.conversationId);
  }, context);

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
  await api.details({ approval: request }, context);

  const answer = await waitForAnswer(api, context);

  return {
    approval: { ...request, decision: answer === APPROVED ? APPROVED : DENIED },
    approved: answer === APPROVED,
  };
}
