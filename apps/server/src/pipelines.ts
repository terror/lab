import { flushHelperUsage } from './helper-usage';
import { historyPipeline } from './history';
import { libraryPipeline } from './library-items';
import { projectionPipeline } from './projections';
import { usagePipeline } from './usage';

type Pipeline = {
  backfill?: () => Promise<unknown>;
  flush: () => Promise<void>;
  start?: () => void;
};

const pipelines: readonly Pipeline[] = [
  projectionPipeline,
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

export function startPipelines() {
  for (const { start } of pipelines) {
    start?.();
  }
}
