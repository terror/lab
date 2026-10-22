import { serveStatic } from '@hono/bun';
import { Hono } from 'hono';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

import { type Api, authenticate } from './access';
import { auth } from './auth';
import { config } from './config';
import sessions from './sessions';

const app = new Hono<Api>();

app.use(logger());

app.get('/api/health', (c) => c.json({ status: 'ok' }));
app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));
app.use('/api/*', csrf({ origin: config.origin }), authenticate);
app.route('/api', sessions);
app.all('/api/*', (c) => c.notFound());

app.get(
  '*',
  serveStatic({
    root: fileURLToPath(new URL('../../client/dist', import.meta.url)),
  })
);

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json({ error: error.message }, error.status);
  }

  if (error instanceof z.ZodError || error instanceof SyntaxError) {
    return c.json({ error: 'Invalid request' }, 400);
  }

  console.error(error);

  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
