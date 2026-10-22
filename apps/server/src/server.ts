import { recoverSessions, registerQueue } from 'durable-harness';

import app from './app';
import { config } from './config';
import { pool } from './db';
import { world } from './harness/runtime';

registerQueue(world);

async function start() {
  try {
    await pool.query('SELECT 1');

    await world.start();
    await recoverSessions(world);

    return Bun.serve({
      hostname: config.hostname,
      idleTimeout: 60,
      fetch: app.fetch,
    });
  } catch (error) {
    await Promise.allSettled([world.close?.(), pool.end()]);

    throw error;
  }
}

const server = await start();

async function shutdown() {
  process.removeListener('SIGINT', shutdown);
  process.removeListener('SIGTERM', shutdown);

  try {
    try {
      await world.close?.();
    } finally {
      try {
        await server.stop(true);
      } finally {
        await pool.end();
      }
    }

    process.exit(0);
  } catch (error) {
    console.error(error);

    process.exit(1);
  }
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
