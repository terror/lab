import { zValidator } from '@hono/zod-validator';
import { workspaceCreationSchema } from '@lab/shared';
import { Hono } from 'hono';

import { auth } from '../auth';
import { type Api, rejectInvalidInput } from '../auth/access';
import {
  type Workspace,
  ensureFamilyWorkspace,
  listUserWorkspaces,
} from '../services/workspaces';

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

const workspaces = new Hono<Api>()
  .get('/workspaces', async (c) => {
    const workspaces = await listUserWorkspaces(c.get('principal').userId);

    return c.json(workspaces.map(workspaceMetadata));
  })
  .post(
    '/workspaces',
    zValidator('json', workspaceCreationSchema, rejectInvalidInput),
    async (c) => {
      const body = c.req.valid('json');

      const organization = await auth.api.createOrganization({
        headers: c.get('principal').headers,
        body: { ...body, keepCurrentActiveOrganization: true },
      });

      const workspace = await ensureFamilyWorkspace(organization.id);

      return c.json(workspaceMetadata(workspace), 201);
    }
  );

export default workspaces;
