import { fauxAssistantMessage, fauxProvider } from '@earendil-works/pi-ai';

import { models } from '../src/models';
import { startServer } from '../src/server';

const faux = fauxProvider({
  models: [
    { id: 'anthropic/claude-sonnet-5.5' },
    { id: 'anthropic/claude-haiku-5.5' },
  ],
  provider: 'vercel-ai-gateway',
});

faux.setResponses(
  Array.from({ length: 100 }, () => async (_context, options) => {
    if (process.env.LAB_TEST_HOLD === '1' && options?.sessionId !== undefined) {
      const held = Promise.withResolvers<void>();

      options.signal?.addEventListener('abort', () => held.resolve(), {
        once: true,
      });

      process.send?.({ kind: 'running' });
      await held.promise;
    }

    return fauxAssistantMessage('bar');
  })
);

models.setProvider(faux.provider);

const { server } = await startServer();

process.send?.({ kind: 'ready', url: server.url.href });
