import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import {
  type AgentChange,
  Harness,
  type HarnessOptions,
} from '@earendil-works/pi-durable';
import { createWorld } from '@workflow/world-local';
import { recoverSessions, registerQueue } from 'durable-harness';
import {
  type PiChatRouteOptions,
  acquireHarness,
  chatRoute,
  openWorldReader,
  resumeWith,
} from 'durable-harness/pi-durable';

export type RuntimeOptions = HarnessOptions & {
  dataDir: string;
};

export type ChatOptions = Pick<
  PiChatRouteOptions,
  'agent' | 'authorize' | 'keepaliveMs' | 'allowPublicSandbox'
>;

export function createRuntime({ dataDir, ...options }: RuntimeOptions) {
  const world = createWorld({ dataDir, recoverActiveRuns: false });
  const open = resumeWith(
    (storage) => Harness.open(storage, options, BACKGROUND_CONTEXT),
    { world }
  );
  const storage = { world, traceAudience: 'private' as const };

  return {
    async start() {
      registerQueue(world);
      await world.start?.();
      await recoverSessions(world);
    },

    async createSession(agent: AgentChange) {
      const lease = await acquireHarness(undefined, open, storage);

      try {
        await lease.harness.root(BACKGROUND_CONTEXT, { agent });
        return lease.storage.sessionId;
      } finally {
        await lease.release();
      }
    },

    async readSession(sessionId: string) {
      const reader = openWorldReader(sessionId, { world });
      await reader.refresh();
      return reader.snapshot();
    },

    async cancelSession(sessionId: string) {
      for (let attempt = 0; ; attempt++) {
        const lease = await acquireHarness(sessionId, open, storage);

        try {
          const root = await lease.harness.root(BACKGROUND_CONTEXT);
          await root.abort(BACKGROUND_CONTEXT, { background: true });
          return;
        } catch (error) {
          if (attempt === 0 && lease.storage.isFenced) {
            continue;
          }

          throw error;
        } finally {
          await lease.release();
        }
      }
    },

    chatRoute(options: ChatOptions) {
      return chatRoute({ ...options, open, ...storage });
    },
  };
}
