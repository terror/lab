import { schema } from '@lab/db';
import { auth } from '@modelcontextprotocol/sdk/client/auth.js';
import { and, asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { PRIVATE_ADDRESS, checkPublicUrl, publicFetch } from './addresses';
import { isAdmin, requireUser } from './auth';
import {
  connectorSlug,
  connectorState,
  refreshConnector,
  removeConnector,
} from './connections';
import {
  checkState,
  connectorAuth,
  connectorIssuer,
  finishAuthorization,
  stateConnector,
} from './connector-auth';
import { db } from './db';
import { found } from './found';
import { rateLimit } from './limits';
import { idParam, validator } from './validator';

const table = schema.connector;

const fields = z.object({
  name: z.string().trim().min(1).max(64),
  url: z.url({ protocol: /^https?$/ }),
});

const creation = validator('json', fields);

const callback = validator(
  'query',
  z.object({
    code: z.string().min(1).optional(),
    error: z.string().optional(),
    iss: z.string().optional(),
    state: z.string().min(1),
  })
);

export async function listConnectors(ownerId: string) {
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

type Owner = { email?: string | null; id: string };

async function checkUrl(owner: Owner, url: string) {
  if (isAdmin(owner)) {
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

function valid<T>(shape: z.ZodType<T>, value: unknown) {
  const result = shape.safeParse(value);

  if (!result.success) {
    throw new HTTPException(400, { message: z.prettifyError(result.error) });
  }

  return result.data;
}

const changeSchema = fields
  .pick({ name: true })
  .partial()
  .extend({ enabled: z.boolean().optional() });

const change = validator('json', changeSchema);

export async function addConnector(
  owner: Owner,
  input: { name: string; url: string }
) {
  const { name, url } = valid(fields, input);

  await checkName(owner.id, name);
  await checkUrl(owner, url);

  const [connector] = await db
    .insert(table)
    .values({ name, ownerId: owner.id, url })
    .returning();

  const row = found(connector, 'Connector not found');

  await refreshConnector(row, isAdmin(owner));

  return row;
}

export async function updateConnector(
  owner: Owner,
  id: number,
  input: { enabled?: boolean; name?: string }
) {
  const update = valid(changeSchema, input);

  await existing(owner.id, id);

  if (update.name !== undefined) {
    await checkName(owner.id, update.name, id);
  }

  const [connector] = await db
    .update(table)
    .set(update)
    .where(and(eq(table.id, id), eq(table.ownerId, owner.id)))
    .returning();

  const row = found(connector, 'Connector not found');

  await refreshConnector(row, isAdmin(owner));

  return row;
}

export async function deleteConnector(owner: Owner, id: number) {
  const row = await existing(owner.id, id);

  await db
    .delete(table)
    .where(and(eq(table.id, id), eq(table.ownerId, owner.id)));

  await removeConnector(id);

  return row;
}

const connectors = new Hono()
  .use(requireUser)
  .get('/', async (c) => c.json(await listConnectors(c.get('user').id)))
  .post('/', rateLimit('connectors'), creation, async (c) => {
    const user = c.get('user');

    await addConnector(user, c.req.valid('json'));

    return c.json(await listConnectors(user.id), 201);
  })
  .patch('/:id', idParam, change, async (c) => {
    const user = c.get('user');

    await updateConnector(user, c.req.valid('param').id, c.req.valid('json'));

    return c.json(await listConnectors(user.id));
  })
  .get('/:id/authorize', idParam, async (c) => {
    const user = c.get('user');

    const row = await existing(user.id, c.req.valid('param').id);

    const redirects = new Array<URL>();

    const result = await auth(
      connectorAuth(row.id, (url) => {
        redirects.push(url);
      }),
      { fetchFn: isAdmin(user) ? undefined : publicFetch, serverUrl: row.url }
    );

    const [target] = redirects;

    if (result === 'REDIRECT' && target) {
      return c.redirect(target.href);
    }

    await refreshConnector(row, isAdmin(user));

    return c.redirect('/settings');
  })
  .get('/callback', callback, async (c) => {
    const user = c.get('user');

    const { code, error, iss, state } = c.req.valid('query');

    const id = found(stateConnector(state), 'Connector not found');

    const row = await existing(user.id, id);

    if (!(await checkState(id, state))) {
      throw new HTTPException(400, {
        message: 'This sign-in expired. Sign in to the connector again.',
      });
    }

    if (error || !code) {
      await finishAuthorization(id);

      return c.redirect('/settings');
    }

    const issuer = await connectorIssuer(id);

    if (iss && issuer && iss !== issuer) {
      throw new HTTPException(400, {
        message: 'The sign-in came back from an unexpected server.',
      });
    }

    await auth(connectorAuth(id), {
      authorizationCode: code,
      fetchFn: isAdmin(user) ? undefined : publicFetch,
      serverUrl: row.url,
    });

    await finishAuthorization(id);

    await refreshConnector(row, isAdmin(user));

    return c.redirect('/settings');
  })
  .post('/:id/reconnect', rateLimit('connectors'), idParam, async (c) => {
    const user = c.get('user');

    await refreshConnector(
      await existing(user.id, c.req.valid('param').id),
      isAdmin(user)
    );

    return c.json(await listConnectors(user.id));
  })
  .delete('/:id', idParam, async (c) => {
    const user = c.get('user');

    await deleteConnector(user, c.req.valid('param').id);

    return c.json(await listConnectors(user.id));
  });

export default connectors;
