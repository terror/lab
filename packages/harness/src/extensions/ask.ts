import { awaitWithContext } from '@earendil-works/chord/context';
import {
  type DocumentWatch,
  defineDoc,
  defineExtension,
  defineTool,
} from '@earendil-works/pi-durable';
import { arr, obj, str } from '@earendil-works/pi-schema';

export const ANSWER_LENGTH = 1_000;

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

const askUser = defineTool({
  name: 'ask_user',
  description:
    "Ask the user a multiple-choice question and wait for their answer. Use it when you need the user's decision to continue and the choices are clear. The user can also type their own answer.",
  callers: ['model'],
  replay: 'safe',
  parameters: obj({
    options: arr(str({ maxLength: 200, minLength: 1 }), {
      description: 'Two to six short answers to choose from.',
      maxItems: 6,
      minItems: 2,
    }),
    question: str({
      description: 'The question to ask.',
      maxLength: 500,
      minLength: 1,
    }),
  }),
  execute: async ({ options, question }, api, context) => {
    await api.details({ options, question }, context);

    await api.commit(async (tx) => {
      await tx.doc(QuestionsDoc, api.conversationId);
    }, context);

    const watch = await api.watchDoc(QuestionsDoc, api.conversationId, context);

    if (!watch) {
      return {
        isError: true,
        output: [{ text: 'Unable to ask the user.', type: 'text' as const }],
      };
    }

    try {
      const answer = await awaitWithContext(
        answerFor(watch, api.callId),
        context
      );

      return {
        details: { answer, options, question },
        output: [
          { text: `The user answered: ${answer}`, type: 'text' as const },
        ],
      };
    } finally {
      await watch.stop();
    }
  },
});

export const ask = defineExtension({ name: 'lab.ask', tools: [askUser] });
