import type { Message } from '@earendil-works/pi-ai';
import {
  type ConversationId,
  GenerationTask,
  defineDoc,
  defineExtension,
  defineTask,
  hook,
  runEndTask,
} from '@earendil-works/pi-durable';

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

export type Titles = {
  get(conversationId: ConversationId): Promise<string | null>;
  set(conversationId: ConversationId, title: string): Promise<void>;
};

export function title(titles: Titles) {
  const GenerateTitle = defineTask<
    Record<string, never>,
    { phase: 'generate' },
    null
  >({
    name: 'lab.title.generate',
    version: 1,
    initial: () => ({ phase: 'generate' }),
    phases: {
      generate: async (_task, runtime, context) => {
        const finish = () =>
          runtime.commit(
            () => ({
              status: 'terminal',
              outcome: { status: 'completed', result: null },
            }),
            context
          );

        const agent = await runtime.agent(context);

        if (!agent.model) {
          return finish();
        }

        const model = runtime.models.getModel(
          agent.model.provider,
          agent.model.modelId
        );

        if (!model) {
          return finish();
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
          .map((message) => `${message.role}: ${text(message)}`)
          .join('\n\n');

        const answer = await runtime.models.completeSimple(
          model,
          {
            systemPrompt: PROMPT,
            messages: [
              { role: 'user', content: transcript, timestamp: runtime.now() },
            ],
          },
          { maxTokens: 32, signal: runtime.signal }
        );

        runtime.signal.throwIfAborted();

        const generated = text(answer).trim().replace(/^"|"$/g, '');

        if (generated) {
          await titles.set(runtime.conversationId, generated);
        }

        return finish();
      },
    },
    abort: async (_task, runtime, context) => {
      await runtime.commit(
        () => ({ status: 'terminal', outcome: { status: 'aborted' } }),
        context
      );
    },
  });

  return defineExtension({
    name: 'lab.title',
    tasks: [GenerateTitle],
    hooks: [
      hook(GenerationTask, {
        afterRun: async (_run, api) => {
          if (await titles.get(api.conversationId)) {
            return undefined;
          }

          return { tasks: [runEndTask(GenerateTitle, {})] };
        },
      }),
    ],
  });
}
