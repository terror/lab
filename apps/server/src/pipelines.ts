import { flushHelperUsage } from './helper-usage';
import { historyPipeline } from './history';
import { libraryPipeline } from './library-items';
import { flushProjections, projectAll } from './projections';
import { usagePipeline } from './usage';

type Pipeline = {
  backfill?: () => Promise<unknown>;
  flush: () => Promise<void>;
};

const pipelines: readonly Pipeline[] = [
  { backfill: projectAll, flush: flushProjections },
  usagePipeline,
  { flush: flushHelperUsage },
  libraryPipeline,
  historyPipeline,
];

export function backfillAll() {
  for (const { backfill } of pipelines) {
    void backfill?.().catch(console.error);
  }
}

export async function flushAll() {
  await Promise.all(pipelines.map(({ flush }) => flush()));
}
