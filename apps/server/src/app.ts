import { serveStatic } from '@hono/bun';
import type { ErrorResponse, HealthResponse } from '@lab/app-protocol';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { fileURLToPath } from 'node:url';

import { agent, transport } from './agent';
import { sessionRoutes } from './routes/sessions';
import { sessionView } from './session-view';

const app = new Hono()
  .use(logger())
  .get('/api/health', (c) => c.json({ status: 'ok' } satisfies HealthResponse))
  .route('/api', sessionRoutes(agent, transport, sessionView))
  .all('/api/*', (c) => c.notFound())
  .get(
    '*',
    serveStatic({
      root: fileURLToPath(new URL('../../web/dist', import.meta.url)),
    })
  )
  .notFound((c) => c.json({ error: 'Not found' } satisfies ErrorResponse, 404));

export type App = typeof app;

export default app;
