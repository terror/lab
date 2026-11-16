import {
  defineDoc,
  defineExtension,
  defineTool,
  section,
} from '@earendil-works/pi-durable';
import { obj, str } from '@earendil-works/pi-schema';
import { randomUUID } from 'node:crypto';

export const MEMORY_LIMIT = 100;

export const MEMORY_LENGTH = 500;

export type Memory = { createdAt: number; id: string; text: string };

export const MemoryDoc = defineDoc<{
  instructions: string;
  memories: Memory[];
  referenceChats?: boolean;
}>({
  kind: 'lab.memory',
  version: 1,
  scope: 'session',
  initial: () => ({ instructions: '', memories: [] }),
  checkpointWhen: () => true,
});

function text(value: string) {
  return [{ text: value, type: 'text' as const }];
}

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
        ...memories.map(({ id, text: memory }) => `- [${id}] ${memory}`),
      ].join('\n'),
    referenceChats &&
      "You can search and read the user's other chats with chat_search and chat_read when earlier conversations would help.",
  ].filter(Boolean);

  return parts.length > 0 ? parts.join('\n\n') : undefined;
}

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
  execute: async ({ text: memory }, api, context) => {
    const id = await api.memo('id', randomUUID().slice(0, 8), context);

    const saved = await api.commit(async (tx) => {
      const doc = await tx.doc(MemoryDoc);

      if (doc.memories.some((entry) => entry.id === id)) {
        return true;
      }

      if (doc.memories.length >= MEMORY_LIMIT) {
        return false;
      }

      doc.memories.push({ createdAt: api.now(), id, text: memory });

      return true;
    }, context);

    if (!saved) {
      return {
        isError: true,
        output: text(
          `Memory is full (${MEMORY_LIMIT} entries). Ask the user what to forget.`
        ),
      };
    }

    return { details: { id }, output: text(`Remembered [${id}]: ${memory}`) };
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
    const removed = await api.commit(async (tx) => {
      const doc = await tx.doc(MemoryDoc);

      const index = doc.memories.findIndex((entry) => entry.id === id);

      if (index < 0) {
        return false;
      }

      doc.memories.splice(index, 1);

      return true;
    }, context);

    if (!removed) {
      return { isError: true, output: text(`No memory has the id ${id}.`) };
    }

    return { details: { id }, output: text(`Forgot [${id}].`) };
  },
});

export const memory = defineExtension({
  name: 'lab.memory',
  sections: [
    section('memory', async ({ read }, context) => {
      const doc = await read.snapshot(MemoryDoc, context);

      return doc ? render(doc) : undefined;
    }),
  ],
  tools: [remember, forget],
});
