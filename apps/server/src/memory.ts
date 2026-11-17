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

async function read() {
  const doc = await harness.snapshot(MemoryDoc, BACKGROUND_CONTEXT);

  return {
    instructions: doc?.instructions ?? '',
    memories: [...(doc?.memories ?? [])],
    referenceChats: doc?.referenceChats ?? false,
  };
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
  .get('/', async (c) => c.json(await read()))
  .patch('/', settings, async (c) => {
    const { instructions, referenceChats } = c.req.valid('json');

    await harness.commit(async (tx) => {
      const doc = await tx.doc(MemoryDoc);

      if (instructions !== undefined) {
        doc.instructions = instructions;
      }

      if (referenceChats !== undefined) {
        doc.referenceChats = referenceChats;
      }
    }, BACKGROUND_CONTEXT);

    return c.json(await read());
  })
  .post('/', addition, async (c) => {
    const { text } = c.req.valid('json');

    const added = await harness.commit(async (tx) => {
      const doc = await tx.doc(MemoryDoc);

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

    if (!added) {
      throw new HTTPException(400, { message: 'Memory is full' });
    }

    return c.json(await read(), 201);
  })
  .delete('/:id', keyParam, async (c) => {
    const { id } = c.req.valid('param');

    const removed = await harness.commit(async (tx) => {
      const doc = await tx.doc(MemoryDoc);

      const index = doc.memories.findIndex((entry) => entry.id === id);

      if (index >= 0) {
        doc.memories.splice(index, 1);
      }

      return index >= 0;
    }, BACKGROUND_CONTEXT);

    found(removed, 'Memory not found');

    return c.json(await read());
  });

export default memory;
