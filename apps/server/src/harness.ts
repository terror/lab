import { openHarness } from '@lab/harness';

import { env } from './env';
import { fallbackModel, models } from './models';

export const harness = await openHarness({
  model: fallbackModel,
  models,
  onReport: (report) => console.error(report),
  path: env.LAB_STORAGE_PATH,
});
