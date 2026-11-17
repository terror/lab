import type { Message } from '@earendil-works/pi-ai';
import {
  GenerationTask,
  defineDoc,
  defineExtension,
  defineTask,
  hook,
  runEndTask,
} from '@earendil-works/pi-durable';

import { type HelperUsage, completeHelper, helperModel } from '../helper';

const MESSAGE_LIMIT = 2_000;

const PROMPT =
  'Write a title of at most six words for the conversation below. Reply with only the title, without quotes or punctuation at the end.';

export const TitleDoc = defineDoc<{ title: string | null }>({
  kind: 'lab.title',
  version: 1,
  scope: 'conversation',
  history: 'latest',
  fork: 'current',
  initial: () => ({ title: null }),
  checkpointWhen: () => true,
});

function text(message: Message) {
  if (typeof message.content === 'string') {
    return message.content;
  }

  return message.content
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('');
}

function generateTitle(onHelperUsage: HelperUsage) {
  return defineTask<Record<string, never>, { phase: 'generate' }, null>({
    name: 'lab.title.generate',
    version: 1,
    initial: () => ({ phase: 'generate' }),
    phases: {
      generate: async (_task, runtime, context) => {
        const finish = (value: string) =>
          runtime.commit(async (tx) => {
            const doc = await tx.doc(TitleDoc, runtime.conversationId);

            if (value && !doc.title) {
              doc.title = value;
            }

            return {
              status: 'terminal',
              outcome: { status: 'completed', result: null },
            };
          }, context);

        const agent = await runtime.agent(context);

        const model = helperModel(runtime.models, agent.model);

        if (!model) {
          return finish('');
        }

        const { items } = await runtime.entries(
          { order: 'ascending' },
          8,
          undefined,
          context
        );

        const transcript = items
          .flatMap((entry) => entry.model ?? [])
          .filter(({ role }) => role === 'user' || role === 'assistant')
          .map(
            (message) =>
              `${message.role}: ${text(message).slice(0, MESSAGE_LIMIT)}`
          )
          .join('\n\n');

        const answer = await completeHelper(runtime.models, model, {
          input: transcript,
          maxTokens: 32,
          prompt: PROMPT,
          signal: runtime.signal,
        });

        runtime.signal.throwIfAborted();

        onHelperUsage(runtime.conversationId, 'title', answer.message);

        return finish(answer.text.replace(/^"|"$/g, ''));
      },
    },
    abort: async (_task, runtime, context) => {
      await runtime.commit(
        () => ({ status: 'terminal', outcome: { status: 'aborted' } }),
        context
      );
    },
  });
}

export function title(onHelperUsage: HelperUsage) {
  const GenerateTitle = generateTitle(onHelperUsage);

  return defineExtension({
    name: 'lab.title',
    tasks: [GenerateTitle],
    hooks: [
      hook(GenerationTask, {
        afterRun: async (_run, api, context) => {
          const doc = await api.snapshot(TitleDoc, api.conversationId, context);

          if (doc?.title) {
            return undefined;
          }

          return { tasks: [runEndTask(GenerateTitle, {})] };
        },
      }),
    ],
  });
}
