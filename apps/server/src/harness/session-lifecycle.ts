import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import {
  EntityConflictError,
  WorkflowRunNotFoundError,
} from '@workflow/errors';
import { acquireHarness } from 'durable-harness/pi-durable';

import type { Session } from '../services/sessions';
import { open, storage, world } from './runtime';

export async function abortSession(session: Session) {
  for (let attempt = 0; ; attempt++) {
    const lease = await acquireHarness(session.sessionId, open, storage);

    try {
      const root = await lease.harness.root(BACKGROUND_CONTEXT, {
        agent: session.configuration,
      });

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
}

export async function closeSession(session: Session) {
  try {
    if (await isClosed(session.sessionId)) {
      return;
    }

    await abortSession(session);

    await world.events.create(session.sessionId, {
      eventType: 'run_cancelled',
      eventData: { cancelReason: 'Session deleted' },
    });
  } catch (error) {
    if (WorkflowRunNotFoundError.is(error)) {
      return;
    }

    if (EntityConflictError.is(error) && (await isClosed(session.sessionId))) {
      return;
    }

    throw error;
  }
}

async function isClosed(sessionId: string) {
  const run = await world.runs.get(sessionId, { resolveData: 'none' });

  return (
    run.status === 'completed' ||
    run.status === 'failed' ||
    run.status === 'cancelled'
  );
}
