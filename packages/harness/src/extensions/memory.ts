import {
  defineExtension,
  defineTool,
  section,
} from '@earendil-works/pi-durable';
import { obj, str } from '@earendil-works/pi-schema';
import { randomUUID } from 'node:crypto';

import { failure, text } from './results';
import { type Owner, userDoc } from './users';

export const MEMORY_LIMIT = 100;

export const MEMORY_LENGTH = 500;

export type Memory = { createdAt: number; id: string; text: string };

export type MemoryState = {
  instructions: string;
  memories: Memory[];
  referenceChats?: boolean;
};

export const MemoryDoc = userDoc<MemoryState>('lab.user.memory', () => ({
  instructions: '',
  memories: [],
}));

function render({
  instructions,
  memories,
  referenceChats,
}: {
  instructions: string;
  memories: readonly Memory[];
  referenceChats?: boolean;
}) {
  const parts = [
    instructions.trim() &&
      `The user's custom instructions:\n${instructions.trim()}`,
    memories.length > 0 &&
      [
        'Things you remember about the user, with their ids for the forget tool:',
        ...memories.map(({ id, text: fact }) => `- [${id}] ${fact}`),
      ].join('\n'),
    referenceChats &&
      "You can search and read the user's other chats with chat_search and chat_read when earlier conversations would help.",
  ].filter(Boolean);

  return parts.length > 0 ? parts.join('\n\n') : undefined;
}

export function memory(owner: Owner) {
  const remember = defineTool({
    name: 'remember',
    description:
      'Save a short, lasting fact about the user or their preferences so you remember it in every future chat. Use it when the user asks you to remember something or shares a preference that will matter later.',
    parameters: obj({
      text: str({
        description: 'The fact to remember, as one short sentence.',
        maxLength: MEMORY_LENGTH,
        minLength: 1,
      }),
    }),
    execute: async ({ text: fact }, api, context) => {
      const id = await api.memo('id', randomUUID().slice(0, 8), context);

      const key = await owner(api.conversationId);

      const saved = await api.commit(async (tx) => {
        const doc = await tx.doc(MemoryDoc, key, null);

        if (doc.memories.some((entry) => entry.id === id)) {
          return true;
        }

        if (doc.memories.length >= MEMORY_LIMIT) {
          return false;
        }

        doc.memories.push({ createdAt: api.now(), id, text: fact });

        return true;
      }, context);

      if (!saved) {
        return failure(
          `Memory is full (${MEMORY_LIMIT} entries). Ask the user what to forget.`
        );
      }

      return {
        details: { id, text: fact },
        output: text(
          `Remembered [${id}]: ${fact}\n\nThis is a new fact; it now also appears in your fact list.`
        ),
      };
    },
  });

  const forget = defineTool({
    name: 'forget',
    description:
      'Forget a remembered fact by its id. Use it when the user asks you to forget something or a remembered fact is no longer true.',
    parameters: obj({
      id: str({ description: 'The id of the memory to forget.' }),
    }),
    execute: async ({ id }, api, context) => {
      const key = await owner(api.conversationId);

      const removed = await api.commit(async (tx) => {
        const doc = await tx.doc(MemoryDoc, key, null);

        const index = doc.memories.findIndex((entry) => entry.id === id);

        return index < 0 ? undefined : doc.memories.splice(index, 1)[0]?.text;
      }, context);

      if (removed === undefined) {
        return failure(`No memory has the id ${id}.`);
      }

      return {
        details: { id, text: removed },
        output: text(`Forgot [${id}].`),
      };
    },
  });

  return defineExtension({
    name: 'lab.memory',
    sections: [
      section('memory', async ({ conversationId, read }, context) => {
        const doc = await read.snapshot(
          MemoryDoc,
          await owner(conversationId),
          context
        );

        return doc ? render(doc) : undefined;
      }),
    ],
    tools: [remember, forget],
  });
}
