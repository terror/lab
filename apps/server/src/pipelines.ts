import { flushHelperUsage } from './helper-usage';
import { backfillHistory, flushHistory } from './history';
import { backfillLibrary, flushLibrary } from './library';
import { flushProjections, projectAll } from './projections';
import { backfillUsage, flushUsage } from './usage';

type Pipeline = {
  backfill?: () => Promise<unknown>;
  flush: () => Promise<void>;
};

const pipelines: readonly Pipeline[] = [
  { backfill: projectAll, flush: flushProjections },
  { backfill: backfillUsage, flush: flushUsage },
  { flush: flushHelperUsage },
  { backfill: backfillLibrary, flush: flushLibrary },
  { backfill: backfillHistory, flush: flushHistory },
];

export function backfillAll() {
  for (const { backfill } of pipelines) {
    void backfill?.().catch(console.error);
  }
}

export async function flushAll() {
  await Promise.all(pipelines.map(({ flush }) => flush()));
}
