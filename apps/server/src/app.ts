import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { serveStatic } from '@hono/bun';
import { ping } from '@lab/db';
import { Hono } from 'hono';
import { compress } from 'hono/compress';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { auth, requireUser } from './auth';
import changelog from './changelog';
import conversations from './conversations';
import { db } from './db';
import { harness } from './harness';
import library from './library';
import memory from './memory';
import { defaultModel, listModels } from './models';
import providers from './providers';
import { contentSecurityPolicy } from './security';
import skills from './skills';
import uploads from './uploads';
import usage from './usage';

const web = fileURLToPath(new URL('../../web/dist', import.meta.url));

const shell = await readFile(`${web}/index.html`, 'utf8').catch(() => '');

const app = new Hono();

if (process.env.NODE_ENV !== 'test') {
  app.use(logger());
}
app.use('/api/*', compress());
app.use(
  secureHeaders({
    contentSecurityPolicy: contentSecurityPolicy(shell),
    referrerPolicy: 'strict-origin-when-cross-origin',
    strictTransportSecurity: 'max-age=31536000; includeSubDomains',
    xFrameOptions: 'DENY',
  })
);

const api = new Hono()
  .get('/health', async (c) => {
    await ping(db);

    const { scheduling } = await harness.inspect(BACKGROUND_CONTEXT);

    if (scheduling !== 'running') {
      throw new HTTPException(503, { message: 'Harness is not running' });
    }

    return c.json({ status: 'ok' });
  })
  .on(['GET', 'POST'], '/auth/*', (c) => auth.handler(c.req.raw))
  .route('/', changelog)
  .get('/models', requireUser, async (c) => {
    const fallback = await defaultModel();

    return c.json({
      default: fallback
        ? { id: fallback.id, provider: fallback.provider }
        : null,
      models: await listModels(),
    });
  })
  .route('/conversations', conversations)
  .route('/providers', providers)
  .route('/library', library)
  .route('/memory', memory)
  .route('/skills', skills)
  .route('/uploads', uploads)
  .route('/usage', usage);

export type AppType = typeof api;

app.route('/api', api);
app.all('/api/*', (c) => c.notFound());

app.use('/assets/*', async (c, next) => {
  await next();

  if (c.res.ok) {
    c.header('cache-control', 'public, max-age=31536000, immutable');
  }
});

app.get('*', serveStatic({ root: web }));
app.get('*', serveStatic({ root: web, path: 'index.html' }));

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json({ error: error.message }, error.status);
  }

  console.error(error);

  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
