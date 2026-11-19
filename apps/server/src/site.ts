import { serveStatic } from '@hono/bun';
import { Hono } from 'hono';

export function site(root: string) {
  return new Hono()
    .use('/assets/*', async (c, next) => {
      await next();

      if (c.res.ok) {
        c.header('cache-control', 'public, max-age=31536000, immutable');
      }
    })
    .get('*', serveStatic({ root }))
    .get('/assets/*', (c) => c.notFound())
    .get('*', serveStatic({ root, path: 'index.html' }));
}
