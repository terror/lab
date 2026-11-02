import app from './app';
import { runtime } from './runtime';

await runtime.start();

export default {
  hostname: Bun.env.LAB_HOST ?? '127.0.0.1',
  idleTimeout: 60,
  fetch: app.fetch,
};
