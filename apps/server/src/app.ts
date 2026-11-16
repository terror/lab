import { serveStatic } from '@hono/bun';
import { ping } from '@lab/db';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import { fileURLToPath } from 'node:url';

import conversations from './conversations';
import { db } from './db';
import { chatModels } from './models';

const app = new Hono();

app.use(logger());

const api = new Hono()
  .get('/health', async (c) => {
    await ping(db);

    return c.json({ status: 'ok' });
  })
  .get('/models', (c) =>
    c.json({
      models: chatModels.map(({ modelId, name }) => ({ id: modelId, name })),
    })
  )
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
