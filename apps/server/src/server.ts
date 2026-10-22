import app from './app';

export default {
  hostname: Bun.env.LAB_HOST ?? '127.0.0.1',
  fetch: app.fetch,
};
