import type { CommitObservation } from '@earendil-works/pi-durable';

import { flushHelperUsage } from './helper-usage';
import { historyPipeline } from './history';
import { libraryPipeline } from './library-items';
import { projectionPipeline } from './projections';
import { toolUsePipeline } from './tool-use';
import { usagePipeline } from './usage';

type Pipeline = {
  backfill?: () => Promise<unknown>;
  flush: () => Promise<void>;
  start?: () => CommitObservation;
};

const pipelines: readonly Pipeline[] = [
  projectionPipeline,
  usagePipeline,
  { flush: flushHelperUsage },
  libraryPipeline,
  historyPipeline,
  toolUsePipeline,
];

export async function backfillAll() {
  for (const { backfill } of pipelines) {
    await backfill?.();
  }
}

export async function flushAll() {
  await Promise.all(pipelines.map(({ flush }) => flush()));
}

export function startPipelines() {
  const observations: CommitObservation[] = [];

  const stop = () =>
    observations.forEach((observation) => observation.detach());

  try {
    for (const { start } of pipelines) {
      if (start) {
        observations.push(start());
      }
    }
  } catch (error) {
    stop();
    throw error;
  }

  return stop;
}
