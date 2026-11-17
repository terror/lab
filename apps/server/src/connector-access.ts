import { schema } from '@lab/db';
import type { ConnectorAccess } from '@lab/harness';
import { eq } from 'drizzle-orm';

import { db } from './db';
import { found } from './found';
import { requireOwner } from './records';

async function owner(conversationId: number) {
  const [user] = await db
    .select({ email: schema.user.email, id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.id, await requireOwner(conversationId)));

  return found(user, 'User not found');
}

async function summaries(ownerId: string) {
  const { listConnectors } = await import('./connectors');

  return (await listConnectors(ownerId)).connectors.map(
    ({ tools, ...connector }) => ({ ...connector, tools: tools.length })
  );
}

async function summary(ownerId: string, id: number) {
  return found(
    (await summaries(ownerId)).find((connector) => connector.id === id),
    'Connector not found'
  );
}

export const connectorAccess: ConnectorAccess = {
  add: async (conversationId, fields) => {
    const { addConnector } = await import('./connectors');

    const user = await owner(conversationId);

    return summary(user.id, (await addConnector(user, fields)).id);
  },
  list: async (conversationId) => summaries((await owner(conversationId)).id),
  remove: async (conversationId, id) => {
    const { deleteConnector } = await import('./connectors');

    const user = await owner(conversationId);

    const removed = await summary(user.id, id);

    await deleteConnector(user, id);

    return removed;
  },
  update: async (conversationId, id, change) => {
    const { updateConnector } = await import('./connectors');

    const user = await owner(conversationId);

    await updateConnector(user, id, change);

    return summary(user.id, id);
  },
};
