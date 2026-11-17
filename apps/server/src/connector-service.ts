import { schema } from '@lab/db';
import { and, asc, eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { PRIVATE_ADDRESS, checkPublicUrl } from './addresses';
import {
  connectorSlug,
  connectorState,
  refreshConnector,
  removeConnector,
} from './connections';
import { db } from './db';
import { found } from './found';
import { policy } from './policy';

const table = schema.connector;

export const connectorFields = z.object({
  name: z.string().trim().min(1).max(64),
  url: z.url({ protocol: /^https?$/ }),
});

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

type Owner = { id: string };

async function checkUrl(owner: Owner, url: string) {
  if ((await policy(owner.id)).privateNetwork) {
    return;
  }

  try {
    await checkPublicUrl(new URL(url));
  } catch {
    throw new HTTPException(400, { message: PRIVATE_ADDRESS });
  }
}

export async function existing(ownerId: string, id: number) {
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

export const connectorChange = connectorFields
  .pick({ name: true })
  .partial()
  .extend({ enabled: z.boolean().optional() });

export async function addConnector(
  owner: Owner,
  input: { name: string; url: string }
) {
  const { name, url } = valid(connectorFields, input);

  await checkName(owner.id, name);
  await checkUrl(owner, url);

  const [connector] = await db
    .insert(table)
    .values({ name, ownerId: owner.id, url })
    .returning();

  const row = found(connector, 'Connector not found');

  await refreshConnector(row);

  return row;
}

export async function updateConnector(
  owner: Owner,
  id: number,
  input: { enabled?: boolean; name?: string }
) {
  const update = valid(connectorChange, input);

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

  await refreshConnector(row);

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
