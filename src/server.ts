import app from './app';

export default {
  hostname: Bun.env.HOST ?? '127.0.0.1',
  fetch: app.fetch,
};
