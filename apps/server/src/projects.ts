import { PROJECT_INSTRUCTIONS_LENGTH, PROJECT_NAME_LENGTH } from '@lab/harness';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { requireUser } from './auth';
import {
  PROJECT_LIMIT,
  createProject,
  listProjects,
  updateProject,
} from './project-access';
import { moveToTrash } from './trash';
import { validator } from './validator';

const params = validator(
  'param',
  z.object({ id: z.coerce.number().int().positive() })
);

const name = z.string().trim().min(1).max(PROJECT_NAME_LENGTH);

const naming = validator('json', z.object({ name }));

const change = validator(
  'json',
  z
    .object({
      instructions: z.string().max(PROJECT_INSTRUCTIONS_LENGTH).optional(),
      name: name.optional(),
    })
    .refine(
      (value) => value.instructions !== undefined || value.name !== undefined,
      'Nothing to change'
    )
);

const projects = new Hono()
  .use(requireUser)
  .get('/', async (c) =>
    c.json({ projects: await listProjects(c.get('user').id) })
  )
  .post('/', naming, async (c) => {
    const project = await createProject(
      c.get('user').id,
      c.req.valid('json').name
    );

    if (!project) {
      throw new HTTPException(400, {
        message: `You can have up to ${PROJECT_LIMIT} projects`,
      });
    }

    return c.json({ project }, 201);
  })
  .patch('/:id', params, change, async (c) => {
    const project = await updateProject(
      c.get('user').id,
      c.req.valid('param').id,
      c.req.valid('json')
    );

    if (!project) {
      throw new HTTPException(404, { message: 'Project not found' });
    }

    return c.json({ project });
  })
  .delete('/:id', params, async (c) => {
    if (
      !(await moveToTrash('project', c.get('user').id, c.req.valid('param').id))
    ) {
      throw new HTTPException(404, { message: 'Project not found' });
    }

    return c.body(null, 204);
  });

export default projects;
