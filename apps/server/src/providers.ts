import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { requireUser } from './auth';
import { credentials } from './credentials';
import { keyProviders, models } from './models';
import { validator } from './validator';

const params = validator('param', z.object({ id: z.string().min(1) }));

const key = validator('json', z.object({ apiKey: z.string().trim().min(1) }));

function provider(id: string) {
  const match = keyProviders().find((candidate) => candidate.id === id);

  if (!match) {
    throw new HTTPException(404, { message: 'Provider not found' });
  }

  return match;
}

const providers = new Hono()
  .use(requireUser)
  .get('/', async (c) => {
    const stored = new Set(
      (await credentials.list()).map(({ providerId }) => providerId)
    );

    const list = await Promise.all(
      keyProviders().map(async ({ id, name }) => ({
        configured: (await models.checkAuth(id)) !== undefined,
        id,
        name,
        stored: stored.has(id),
      }))
    );

    return c.json({ providers: list });
  })
  .put('/:id', params, key, async (c) => {
    const { id } = provider(c.req.valid('param').id);

    const { apiKey } = c.req.valid('json');

    await credentials.modify(id, async () => ({
      key: apiKey,
      type: 'api_key',
    }));

    return c.body(null, 204);
  })
  .delete('/:id', params, async (c) => {
    const { id } = provider(c.req.valid('param').id);

    await credentials.delete(id);

    return c.body(null, 204);
  });

export default providers;
