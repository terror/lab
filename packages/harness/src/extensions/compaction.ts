import type { Message } from '@earendil-works/pi-ai';
import {
  AgentDoc,
  CompactionTask,
  defineExtension,
  hook,
} from '@earendil-works/pi-durable';

import { type HelperUsage, completeHelper, helperModel } from '../helper';

const PROMPT =
  'Summarize the conversation below so it can continue without the original messages. Keep every decision, fact, open question, file name, and piece of code the conversation still depends on. Write plain prose and short lists, with no preamble.';

const TOOL_OUTPUT = 2_000;

const MAX_TOKENS = 4_096;

function text(content: Message['content']) {
  if (typeof content === 'string') {
    return content;
  }

  return content
    .map((part) => {
      if (part.type === 'text') {
        return part.text;
      }

      if (part.type === 'toolCall') {
        return `[called ${part.name}]`;
      }

      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function serialize(messages: readonly Message[]) {
  return messages
    .map((message) => {
      if (message.role === 'toolResult') {
        return `tool ${message.toolName}: ${text(message.content).slice(0, TOOL_OUTPUT)}`;
      }

      return `${message.role}: ${text(message.content)}`;
    })
    .join('\n\n');
}

export function compaction(onHelperUsage: HelperUsage) {
  return defineExtension({
    name: 'lab.compaction',
    hooks: [
      hook(CompactionTask, {
        beforeCompact: async ({ instructions, messages }, api, context) => {
          const saved = await api.memo<string>('summary', context);

          if (saved) {
            return { summary: saved };
          }

          const agent = await api.snapshot(
            AgentDoc,
            api.conversationId,
            context
          );

          const model = helperModel(api.models, agent?.model);

          const transcript = serialize(messages);

          if (!model || transcript.length > model.contextWindow * 2) {
            return undefined;
          }

          const answer = await completeHelper(api.models, model, {
            input: transcript,
            maxTokens: MAX_TOKENS,
            prompt: instructions ? `${PROMPT}\n\n${instructions}` : PROMPT,
            signal: context.abortSignal,
          });

          if (answer.message.stopReason === 'error') {
            return undefined;
          }

          onHelperUsage(api.conversationId, 'compaction', answer.message);

          context.abortSignal?.throwIfAborted();

          const summary = answer.text;

          if (!summary) {
            return undefined;
          }

          return { summary: await api.memo('summary', summary, context) };
        },
      }),
    ],
  });
}
