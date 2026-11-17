import { schema } from '@lab/db';
import { asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { requireUser } from './auth';
import {
  connectorSlug,
  connectorState,
  refreshConnector,
  removeConnector,
} from './connections';
import { db } from './db';
import { found } from './found';
import { idParam, validator } from './validator';

const table = schema.connector;

const fields = z.object({
  name: z.string().trim().min(1).max(64),
  url: z.url({ protocol: /^https?$/ }),
});

const creation = validator('json', fields);

const change = validator(
  'json',
  fields
    .pick({ name: true })
    .partial()
    .extend({ enabled: z.boolean().optional() })
);

async function list() {
  const rows = await db.select().from(table).orderBy(asc(table.createdAt));

  return {
    connectors: rows.map(({ enabled, id, name, url }) => {
      const state = connectorState(id);

      return {
        enabled,
        error: state.kind === 'error' ? state.message : null,
        id,
        name,
        status: state.kind,
        tools: state.kind === 'connected' ? state.tools : [],
        url,
      };
    }),
  };
}

async function checkName(name: string, id?: number) {
  const rows = await db.select({ id: table.id, name: table.name }).from(table);

  const taken = rows.some(
    (row) => row.id !== id && connectorSlug(row.name) === connectorSlug(name)
  );

  if (taken) {
    throw new HTTPException(409, {
      message: 'A connector with that name already exists',
    });
  }
}

async function existing(id: number) {
  const [connector] = await db.select().from(table).where(eq(table.id, id));

  return found(connector, 'Connector not found');
}

const connectors = new Hono()
  .use(requireUser)
  .get('/', async (c) => c.json(await list()))
  .post('/', creation, async (c) => {
    const { name, url } = c.req.valid('json');

    await checkName(name);

    const [connector] = await db
      .insert(table)
      .values({ name, url })
      .returning();

    await refreshConnector(found(connector, 'Connector not found'));

    return c.json(await list(), 201);
  })
  .patch('/:id', idParam, change, async (c) => {
    const { id } = c.req.valid('param');

    const update = c.req.valid('json');

    await existing(id);

    if (update.name !== undefined) {
      await checkName(update.name, id);
    }

    const [connector] = await db
      .update(table)
      .set(update)
      .where(eq(table.id, id))
      .returning();

    await refreshConnector(found(connector, 'Connector not found'));

    return c.json(await list());
  })
  .post('/:id/reconnect', idParam, async (c) => {
    await refreshConnector(await existing(c.req.valid('param').id));

    return c.json(await list());
  })
  .delete('/:id', idParam, async (c) => {
    const { id } = c.req.valid('param');

    await existing(id);

    await db.delete(table).where(eq(table.id, id));

    await removeConnector(id);

    return c.json(await list());
  });

export default connectors;
