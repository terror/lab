import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { MEMORY_LENGTH, MEMORY_LIMIT, MemoryDoc } from '@lab/harness';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { requireUser } from './auth';
import { found } from './found';
import { harness } from './harness';
import { keyParam, validator } from './validator';

export async function readMemory(ownerId: string) {
  const doc = await harness.snapshot(MemoryDoc, ownerId, BACKGROUND_CONTEXT);

  return {
    instructions: doc?.instructions ?? '',
    memories: [...(doc?.memories ?? [])],
    referenceChats: doc?.referenceChats ?? false,
  };
}

export async function addMemory(ownerId: string, text: string) {
  return harness.commit(async (tx) => {
    const doc = await tx.doc(MemoryDoc, ownerId, null);

    if (doc.memories.length >= MEMORY_LIMIT) {
      return false;
    }

    doc.memories.push({
      createdAt: Date.now(),
      id: randomUUID().slice(0, 8),
      text,
    });

    return true;
  }, BACKGROUND_CONTEXT);
}

export async function removeMemory(ownerId: string, id: string) {
  return harness.commit(async (tx) => {
    const doc = await tx.doc(MemoryDoc, ownerId, null);

    const index = doc.memories.findIndex((entry) => entry.id === id);

    if (index >= 0) {
      doc.memories.splice(index, 1);
    }

    return index >= 0;
  }, BACKGROUND_CONTEXT);
}

const settings = validator(
  'json',
  z.object({
    instructions: z.string().max(4_000).optional(),
    referenceChats: z.boolean().optional(),
  })
);

const addition = validator(
  'json',
  z.object({ text: z.string().trim().min(1).max(MEMORY_LENGTH) })
);

const memory = new Hono()
  .use(requireUser)
  .get('/', async (c) => c.json(await readMemory(c.get('user').id)))
  .patch('/', settings, async (c) => {
    const { instructions, referenceChats } = c.req.valid('json');

    await harness.commit(async (tx) => {
      const doc = await tx.doc(MemoryDoc, c.get('user').id, null);

      if (instructions !== undefined) {
        doc.instructions = instructions;
      }

      if (referenceChats !== undefined) {
        doc.referenceChats = referenceChats;
      }
    }, BACKGROUND_CONTEXT);

    return c.json(await readMemory(c.get('user').id));
  })
  .post('/', addition, async (c) => {
    const { text } = c.req.valid('json');

    if (!(await addMemory(c.get('user').id, text))) {
      throw new HTTPException(400, { message: 'Memory is full' });
    }

    return c.json(await readMemory(c.get('user').id), 201);
  })
  .delete('/:id', keyParam, async (c) => {
    const { id } = c.req.valid('param');

    found(await removeMemory(c.get('user').id, id), 'Memory not found');

    return c.json(await readMemory(c.get('user').id));
  });

export default memory;
