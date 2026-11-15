import { serveStatic } from '@hono/bun';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import { fileURLToPath } from 'node:url';

import conversations from './conversations';

const app = new Hono();

app.use(logger());

const api = new Hono()
  .get('/health', (c) => c.json({ status: 'ok' }))
  .route('/conversations', conversations);

export type AppType = typeof api;

app.route('/api', api);
app.all('/api/*', (c) => c.notFound());

app.get(
  '*',
  serveStatic({
    root: fileURLToPath(new URL('../../web/dist', import.meta.url)),
  })
);

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json({ error: error.message }, error.status);
  }

  console.error(error);

  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
