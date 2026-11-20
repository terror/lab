import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { schema } from '@lab/db';
import {
  ComputerDoc,
  type ExtensionDeps,
  adoptGlobalDocs,
  openHarness,
} from '@lab/harness';
import { sql } from 'drizzle-orm';

import { artifactStateAccess } from './artifact-state';
import { sealOAuthTokens } from './auth';
import { chatsAccess } from './chat-access';
import { startConnectors, stopConnectors } from './connections';
import { connectorAccess } from './connector-access';
import { resealSecrets } from './credentials';
import { db } from './db';
import { env } from './env';
import { closeStreams, startStreams } from './event-streams';
import { harness, installHarness, purgeDeleted } from './harness';
import { recordHelperUsage } from './helper-usage';
import { historyAccess } from './history-access';
import { imageAccess } from './image-access';
import { libraryAccess } from './library-access';
import { models } from './models';
import { backfillAll, flushAll, startPipelines } from './pipelines';
import { projectAccess } from './project-tools';
import { requireOwner, trackOwners } from './records';
import { registry } from './registry';
import { createSandboxAccess } from './sandbox';
import { scheduleAccess } from './schedule-access';
import { startScheduler } from './scheduler';
import { checkSpend } from './spend';
import { stopStatus } from './status';
import { webAccess } from './web-access';

export function harnessDeps(): ExtensionDeps {
  return {
    admit: async (conversationId) =>
      checkSpend(await requireOwner(conversationId)),
    artifactState: artifactStateAccess,
    chats: chatsAccess,
    connectors: connectorAccess,
    history: historyAccess,
    images: imageAccess,
    library: libraryAccess,
    onHelperUsage: recordHelperUsage,
    owner: requireOwner,
    project: projectAccess,
    sandbox: createSandboxAccess(
      async (ownerId) =>
        (await harness().snapshot(ComputerDoc, ownerId, BACKGROUND_CONTEXT))
          ?.network ?? 'full'
    ),
    schedule: scheduleAccess,
    web: webAccess(),
  };
}

type Runtime = {
  harness: Awaited<ReturnType<typeof openHarness>>;
  close: () => Promise<void>;
};

type State =
  | { kind: 'stopped' }
  | { kind: 'started'; ready: Promise<Runtime> }
  | { kind: 'stopping'; closed: Promise<void> };

let state: State = { kind: 'stopped' };

async function openRuntime(): Promise<Runtime> {
  await purgeDeleted(env.LAB_STORAGE_PATH);

  const opened = await openHarness({
    ...harnessDeps(),
    models,
    onReport: (report) => console.error(report),
    path: env.LAB_STORAGE_PATH,
    registry,
  });

  const releases: (() => void)[] = [];

  const cleanup: (() => void | Promise<void>)[] = [
    closeStreams,
    stopStatus,
    () => opened.close(BACKGROUND_CONTEXT),
    flushAll,
    stopConnectors,
    () => releases.toReversed().forEach((release) => release()),
  ];

  let closing: Promise<void> | undefined;

  const close = () => {
    if (closing) {
      return closing;
    }

    closing = (async () => {
      const errors: unknown[] = [];

      for (const operation of cleanup) {
        try {
          await operation();
        } catch (error) {
          errors.push(error);
        }
      }

      state = { kind: 'stopped' };

      if (errors.length > 0) {
        throw new AggregateError(errors, 'Failed to close the server runtime');
      }
    })();

    state = { kind: 'stopping', closed: closing };

    return closing;
  };

  try {
    releases.push(installHarness(opened));
    releases.push(await trackOwners(opened));
    releases.push(startPipelines());

    const [admin] = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(sql`lower(${schema.user.email}) = lower(${env.LAB_ADMIN_EMAIL})`);

    if (admin) {
      await adoptGlobalDocs(opened, admin.id, BACKGROUND_CONTEXT);
    }

    await resealSecrets();
    await sealOAuthTokens();
    await startConnectors();
    await backfillAll();

    startStreams();
    opened.resume();
    const scheduler = startScheduler();

    cleanup.unshift(scheduler.stop);
    await scheduler.ready;

    return { close, harness: opened };
  } catch (error) {
    await close().catch((cleanupError: unknown) => {
      throw new AggregateError(
        [error, cleanupError],
        'Failed to start the server runtime',
        { cause: error }
      );
    });

    throw error;
  }
}

export function startRuntime(): Promise<Runtime> {
  switch (state.kind) {
    case 'started':
      return state.ready;
    case 'stopping':
      return state.closed.then(startRuntime);
    case 'stopped': {
      const ready = openRuntime().catch((error: unknown) => {
        state = { kind: 'stopped' };
        throw error;
      });

      state = { kind: 'started', ready };
      return ready;
    }
  }
}
