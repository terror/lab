import { Hono } from 'hono';
import { z } from 'zod';

import { auth } from '../auth';
import type { Api } from '../auth/access';
import {
  type Workspace,
  ensureFamilyWorkspace,
  listUserWorkspaces,
} from '../services/workspaces';

const creationSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

function workspaceMetadata(workspace: Workspace) {
  return {
    id: workspace.id,
    kind: workspace.kind,
    ownerId: workspace.ownerId,
    organizationId: workspace.organizationId,
    name: workspace.name,
    createdAt: workspace.createdAt.toISOString(),
  };
}

const workspaces = new Hono<Api>();

workspaces.get('/workspaces', async (c) => {
  const workspaces = await listUserWorkspaces(c.get('principal').userId);

  return c.json(workspaces.map(workspaceMetadata));
});

workspaces.post('/workspaces', async (c) => {
  const body = creationSchema.parse(await c.req.json());

  const organization = await auth.api.createOrganization({
    headers: c.get('principal').headers,
    body: { ...body, keepCurrentActiveOrganization: true },
  });

  const workspace = await ensureFamilyWorkspace(organization.id);

  return c.json(workspaceMetadata(workspace), 201);
});

export default workspaces;
