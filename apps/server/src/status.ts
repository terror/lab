import type { AssistantMessage } from '@earendil-works/pi-ai';
import {
  AgentDoc,
  type AgentState,
  type ConversationView,
  LiveDoc,
  type LiveState,
} from '@earendil-works/pi-durable';
import { helperModel } from '@lab/harness';

import { recordHelperUsage } from './helper-usage';
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

type Send = (status: string) => Promise<void>;

type Usage = (message: AssistantMessage) => void;

class StatusReporter {
  #at = 0;
  #onUsage: Usage;
  #pending = false;
  #send: Send;
  #signal: AbortSignal;
  #summarized = 0;

  constructor(send: Send, signal: AbortSignal, onUsage: Usage) {
    this.#onUsage = onUsage;
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

      this.#onUsage(answer);

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

type Channel = {
  controller: AbortController;
  listeners: Set<Send>;
  reporter: StatusReporter;
};

const channels = new Map<number, Channel>();

function channel(id: number) {
  const existing = channels.get(id);

  if (existing) {
    return existing;
  }

  const controller = new AbortController();

  const listeners = new Set<Send>();

  const reporter = new StatusReporter(
    async (status) => {
      await Promise.allSettled([...listeners].map((send) => send(status)));
    },
    controller.signal,
    (message) => recordHelperUsage(id, 'status', message)
  );

  const created = { controller, listeners, reporter };

  channels.set(id, created);

  return created;
}

export function subscribeStatus(id: number, send: Send) {
  const subscribed = channel(id);

  subscribed.listeners.add(send);

  return {
    report: (view: ConversationView) => subscribed.reporter.report(view),
    unsubscribe: () => {
      subscribed.listeners.delete(send);

      if (subscribed.listeners.size === 0) {
        subscribed.controller.abort();
        channels.delete(id);
      }
    },
  };
}
