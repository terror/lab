import { schema } from '@lab/db';
import { and, asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { PRIVATE_ADDRESS, checkPublicUrl } from './addresses';
import { type User, isAdmin, requireUser } from './auth';
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

async function list(ownerId: string) {
  const rows = await db
    .select()
    .from(table)
    .where(eq(table.ownerId, ownerId))
    .orderBy(asc(table.createdAt));

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

async function checkName(ownerId: string, name: string, id?: number) {
  const rows = await db
    .select({ id: table.id, name: table.name })
    .from(table)
    .where(eq(table.ownerId, ownerId));

  const taken = rows.some(
    (row) => row.id !== id && connectorSlug(row.name) === connectorSlug(name)
  );

  if (taken) {
    throw new HTTPException(409, {
      message: 'A connector with that name already exists',
    });
  }
}

async function checkUrl(user: User, url: string) {
  if (isAdmin(user)) {
    return;
  }

  try {
    await checkPublicUrl(new URL(url));
  } catch {
    throw new HTTPException(400, { message: PRIVATE_ADDRESS });
  }
}

async function existing(ownerId: string, id: number) {
  const [connector] = await db
    .select()
    .from(table)
    .where(and(eq(table.id, id), eq(table.ownerId, ownerId)));

  return found(connector, 'Connector not found');
}

const connectors = new Hono()
  .use(requireUser)
  .get('/', async (c) => c.json(await list(c.get('user').id)))
  .post('/', creation, async (c) => {
    const user = c.get('user');

    const { name, url } = c.req.valid('json');

    await checkName(user.id, name);
    await checkUrl(user, url);

    const [connector] = await db
      .insert(table)
      .values({ name, ownerId: user.id, url })
      .returning();

    await refreshConnector(
      found(connector, 'Connector not found'),
      isAdmin(user)
    );

    return c.json(await list(user.id), 201);
  })
  .patch('/:id', idParam, change, async (c) => {
    const user = c.get('user');

    const { id } = c.req.valid('param');

    const update = c.req.valid('json');

    await existing(user.id, id);

    if (update.name !== undefined) {
      await checkName(user.id, update.name, id);
    }

    const [connector] = await db
      .update(table)
      .set(update)
      .where(and(eq(table.id, id), eq(table.ownerId, user.id)))
      .returning();

    await refreshConnector(
      found(connector, 'Connector not found'),
      isAdmin(user)
    );

    return c.json(await list(user.id));
  })
  .post('/:id/reconnect', idParam, async (c) => {
    const user = c.get('user');

    await refreshConnector(
      await existing(user.id, c.req.valid('param').id),
      isAdmin(user)
    );

    return c.json(await list(user.id));
  })
  .delete('/:id', idParam, async (c) => {
    const user = c.get('user');

    const { id } = c.req.valid('param');

    await existing(user.id, id);

    await db
      .delete(table)
      .where(and(eq(table.id, id), eq(table.ownerId, user.id)));

    await removeConnector(id);

    return c.json(await list(user.id));
  });

export default connectors;
