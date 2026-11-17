import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { requireUser } from './auth';
import { credentials } from './credentials';
import { keyProviders } from './models';
import { sandboxProviders } from './sandbox';
import { validator } from './validator';
import { searchProviders } from './web-access';

const params = validator('param', z.object({ id: z.string().min(1) }));

const connection = validator(
  'json',
  z.discriminatedUnion('method', [
    z.object({
      apiKey: z.string().trim().min(1),
      method: z.literal('api_key'),
      settings: z.record(z.string(), z.string().trim().min(1)).optional(),
    }),
  ])
);

const keyField = { id: 'apiKey', label: 'API key', secret: true };

function allProviders() {
  return [
    ...keyProviders().map(({ id, name }) => ({
      fields: [keyField],
      id,
      kind: 'model' as const,
      name,
    })),
    ...searchProviders.map(({ id, name }) => ({
      fields: [keyField],
      id,
      kind: 'search' as const,
      name,
    })),
    ...sandboxProviders.map(({ fields, id, name }) => ({
      fields,
      id,
      kind: 'computer' as const,
      name,
    })),
  ];
}

function provider(id: string) {
  const match = allProviders().find((candidate) => candidate.id === id);

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

    const list = allProviders().map(({ fields, id, kind, name }) => ({
      configured: stored.has(id),
      fields,
      id,
      kind,
      methods: ['api_key' as const],
      name,
    }));

    return c.json({ providers: list });
  })
  .put('/:id', params, connection, async (c) => {
    const { fields, id } = provider(c.req.valid('param').id);

    const { apiKey, settings } = c.req.valid('json');

    const missing = fields.find(
      (field) => field.id !== 'apiKey' && !settings?.[field.id]
    );

    if (missing) {
      throw new HTTPException(400, { message: `${missing.label} is required` });
    }

    const env = Object.fromEntries(
      fields.flatMap(({ id: field }) =>
        field !== 'apiKey' && settings?.[field]
          ? [[field, settings[field]]]
          : []
      )
    );

    await credentials.modify(id, async () => ({
      key: apiKey,
      type: 'api_key',
      ...(Object.keys(env).length > 0 && { env }),
    }));

    return c.body(null, 204);
  })
  .delete('/:id', params, async (c) => {
    const { id } = provider(c.req.valid('param').id);

    await credentials.delete(id);

    return c.body(null, 204);
  });

export default providers;
