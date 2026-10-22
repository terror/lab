import { serveStatic } from '@hono/bun';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { fileURLToPath } from 'node:url';

import sessions from './sessions';

const app = new Hono();

app.use(logger());

app.get('/api/health', (c) => c.json({ status: 'ok' }));
app.route('/api', sessions);
app.all('/api/*', (c) => c.notFound());

app.get(
  '*',
  serveStatic({
    root: fileURLToPath(new URL('../../client/dist', import.meta.url)),
  })
);

app.notFound((c) => c.json({ error: 'Not found' }, 404));

export default app;
