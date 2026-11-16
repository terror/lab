import type { AssistantMessage } from '@earendil-works/pi-ai';
import {
  AgentDoc,
  type AgentState,
  type ConversationView,
  LiveDoc,
  type LiveState,
} from '@earendil-works/pi-durable';
import { helperModel } from '@lab/harness';

import { models } from './models';

const PROMPT =
  'You label what an assistant is doing from a passage of its private reasoning. Reply with one phrase of two to six words that starts with a present participle, like "Comparing train routes". No quotes or final punctuation.';

const INTERVAL_MS = 2_500;

const MIN_GROWTH = 160;

const WINDOW = 1_500;

function thinking(view: ConversationView) {
  const live = view.docs[LiveDoc.definition.kind] as LiveState | undefined;

  return (live?.generation?.message?.content ?? [])
    .map((part) => (part.type === 'thinking' ? part.thinking : ''))
    .join('');
}

function phrase(message: AssistantMessage) {
  return message.content
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('')
    .trim()
    .replace(/^["']|["'.]$/g, '');
}

export class StatusReporter {
  #at = 0;
  #pending = false;
  #send: (status: string) => Promise<void>;
  #signal: AbortSignal;
  #summarized = 0;

  constructor(send: (status: string) => Promise<void>, signal: AbortSignal) {
    this.#send = send;
    this.#signal = signal;
  }

  async report(view: ConversationView) {
    const text = thinking(view);

    const agent = view.docs[AgentDoc.definition.kind] as AgentState | undefined;

    const model = helperModel(models, agent?.model);

    if (text.length < this.#summarized) {
      this.#summarized = 0;
    }

    if (
      !model ||
      this.#pending ||
      text.length - this.#summarized < MIN_GROWTH ||
      Date.now() - this.#at < INTERVAL_MS
    ) {
      return;
    }

    this.#pending = true;
    this.#summarized = text.length;
    this.#at = Date.now();

    try {
      const answer = await models.completeSimple(
        model,
        {
          systemPrompt: PROMPT,
          messages: [
            {
              role: 'user',
              content: text.slice(-WINDOW),
              timestamp: Date.now(),
            },
          ],
        },
        { maxTokens: 24, signal: this.#signal }
      );

      const status = phrase(answer);

      if (answer.stopReason !== 'error' && status && !this.#signal.aborted) {
        await this.#send(status);
      }
    } catch (error) {
      if (!this.#signal.aborted) {
        console.error(error);
      }
    } finally {
      this.#pending = false;
    }
  }
}
