import { Hono } from 'hono';
import { logger } from 'hono/logger';

const app = new Hono();

app.use(logger());

app.get('/', (c) => c.json({ name: 'lab' }));
app.get('/api/health', (c) => c.json({ status: 'ok' }));

app.notFound((c) => c.json({ error: 'Not found' }, 404));

export default app;
