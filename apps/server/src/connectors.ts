import { auth } from '@modelcontextprotocol/sdk/client/auth.js';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { requireUser } from './auth';
import { refreshConnector } from './connections';
import {
  checkState,
  connectorAuth,
  connectorIssuer,
  finishAuthorization,
  stateConnector,
} from './connector-auth';
import {
  addConnector,
  connectorChange,
  connectorFields,
  deleteConnector,
  existing,
  listConnectors,
  trustConnector,
  updateConnector,
} from './connector-service';
import { found } from './found';
import { rateLimit } from './limits';
import { policy } from './policy';
import { idParam, validator } from './validator';

const creation = validator('json', connectorFields);

const callback = validator(
  'query',
  z.object({
    code: z.string().min(1).optional(),
    error: z.string().optional(),
    iss: z.string().optional(),
    state: z.string().min(1),
  })
);

const change = validator('json', connectorChange);

const trust = validator('json', z.object({ readOnly: z.boolean() }));

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
  .put('/:id/trust', idParam, trust, async (c) => {
    const user = c.get('user');

    await trustConnector(
      user,
      c.req.valid('param').id,
      c.req.valid('json').readOnly
    );

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
      { fetchFn: (await policy(user.id)).fetch, serverUrl: row.url }
    );

    const [target] = redirects;

    if (result === 'REDIRECT' && target) {
      return c.redirect(target.href);
    }

    await refreshConnector(row);

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
      fetchFn: (await policy(user.id)).fetch,
      serverUrl: row.url,
    });

    await finishAuthorization(id);

    await refreshConnector(row);

    return c.redirect('/settings');
  })
  .post('/:id/reconnect', rateLimit('connectors'), idParam, async (c) => {
    const user = c.get('user');

    await refreshConnector(await existing(user.id, c.req.valid('param').id));

    return c.json(await listConnectors(user.id));
  })
  .delete('/:id', idParam, async (c) => {
    const user = c.get('user');

    await deleteConnector(user, c.req.valid('param').id);

    return c.json(await listConnectors(user.id));
  });

export default connectors;
