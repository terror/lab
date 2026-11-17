import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import {
  SKILL_DESCRIPTION_LENGTH,
  SKILL_INSTRUCTIONS_LENGTH,
  SKILL_NAME_LENGTH,
  type SkillChange,
  SkillsDoc,
  createSkill,
  deleteSkill,
  updateSkill,
} from '@lab/harness';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { requireUser } from './auth';
import { harness } from './harness';
import { validator } from './validator';

const fields = z.object({
  description: z.string().trim().min(1).max(SKILL_DESCRIPTION_LENGTH),
  instructions: z.string().trim().min(1).max(SKILL_INSTRUCTIONS_LENGTH),
  name: z.string().trim().min(1).max(SKILL_NAME_LENGTH),
});

const creation = validator('json', fields);

const change = validator('json', fields.partial());

const params = validator('param', z.object({ id: z.string().min(1) }));

const failures = {
  duplicate: [409, 'A skill with that name already exists'],
  full: [400, 'Skills are full'],
  missing: [404, 'Skill not found'],
} as const;

function saved(result: SkillChange) {
  if (result.kind !== 'saved') {
    const [status, message] = failures[result.kind];

    throw new HTTPException(status, { message });
  }

  return result.skill;
}

async function read() {
  const doc = await harness.snapshot(SkillsDoc, BACKGROUND_CONTEXT);

  return { skills: [...(doc?.skills ?? [])] };
}

const skills = new Hono()
  .use(requireUser)
  .get('/', async (c) => c.json(await read()))
  .post('/', creation, async (c) => {
    const result = await harness.commit(
      async (tx) =>
        createSkill(await tx.doc(SkillsDoc), {
          ...c.req.valid('json'),
          id: randomUUID().slice(0, 8),
          now: Date.now(),
        }),
      BACKGROUND_CONTEXT
    );

    saved(result);

    return c.json(await read(), 201);
  })
  .patch('/:id', params, change, async (c) => {
    const result = await harness.commit(
      async (tx) =>
        updateSkill(await tx.doc(SkillsDoc), {
          ...c.req.valid('json'),
          id: c.req.valid('param').id,
          now: Date.now(),
        }),
      BACKGROUND_CONTEXT
    );

    saved(result);

    return c.json(await read());
  })
  .delete('/:id', params, async (c) => {
    const removed = await harness.commit(
      async (tx) =>
        deleteSkill(await tx.doc(SkillsDoc), c.req.valid('param').id),
      BACKGROUND_CONTEXT
    );

    if (!removed) {
      throw new HTTPException(404, { message: 'Skill not found' });
    }

    return c.json(await read());
  });

export default skills;
