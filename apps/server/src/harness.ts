import { openHarness } from '@lab/harness';

import { env } from './env';
import { defaultModel, models } from './models';
import { titles } from './titles';

export const harness = await openHarness({
  model: defaultModel,
  models,
  onReport: (report) => console.error(report),
  path: env.LAB_STORAGE_PATH,
  titles,
});
