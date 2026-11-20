import app from './app';
import { db } from './db';
import { env } from './env';
import { closeStreams } from './event-streams';
import { initSentry } from './instrument';
import { startRuntime } from './runtime';

export async function startServer() {
  initSentry();

  const runtime = await startRuntime();

  const server = await Promise.try(() =>
    Bun.serve({
      fetch: app.fetch,
      hostname: env.LAB_HOST,
    })
  ).catch(async (error: unknown) => {
    try {
      await runtime.close();
    } finally {
      await db.$client.close();
    }

    throw error;
  });

  let closing: Promise<void> | undefined;

  const close = () =>
    (closing ??= (async () => {
      for (const signal of ['SIGINT', 'SIGTERM'] as const) {
        process.off(signal, shutdown);
      }

      const stopped = server.stop();

      closeStreams();

      try {
        await stopped;
        await runtime.close();
      } finally {
        await db.$client.close();
      }
    })());

  const shutdown = () => {
    void close().then(
      () => process.exit(0),
      (error: unknown) => {
        console.error(error);
        process.exit(1);
      }
    );
  };

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, shutdown);
  }

  return { close, server };
}

if (import.meta.main) {
  await startServer();
}
