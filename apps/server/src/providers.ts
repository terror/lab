import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { requireAdmin, requireUser } from './auth';
import { credentials } from './credentials';
import { found } from './found';
import { keyProviders } from './models';
import { sandboxProviders } from './sandbox';
import { keyParam, validator } from './validator';
import { searchProviders } from './web-access';

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

const providerKinds = [
  {
    id: 'model',
    label: 'Models',
    providers: () =>
      keyProviders().map(({ id, name }) => ({ fields: [keyField], id, name })),
  },
  {
    id: 'search',
    label: 'Web search',
    providers: () =>
      searchProviders.map(({ id, name }) => ({ fields: [keyField], id, name })),
  },
  { id: 'computer', label: 'Computer', providers: () => sandboxProviders },
] as const;

function allProviders() {
  return providerKinds.flatMap(({ id: kind, label, providers: list }) =>
    list().map((entry) => ({ ...entry, kind, kindLabel: label }))
  );
}

function provider(id: string) {
  return found(
    allProviders().find((candidate) => candidate.id === id),
    'Provider not found'
  );
}

const providers = new Hono()
  .use(requireUser)
  .use(requireAdmin)
  .get('/', async (c) => {
    const stored = new Set(
      (await credentials.list()).map(({ providerId }) => providerId)
    );

    const list = allProviders().map(
      ({ fields, id, kind, kindLabel, name }) => ({
        configured: stored.has(id),
        fields,
        id,
        kind,
        kindLabel,
        methods: ['api_key' as const],
        name,
      })
    );

    return c.json({ providers: list });
  })
  .put('/:id', keyParam, connection, async (c) => {
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
  .delete('/:id', keyParam, async (c) => {
    const { id } = provider(c.req.valid('param').id);

    await credentials.delete(id);

    return c.body(null, 204);
  });

export default providers;
