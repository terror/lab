import { openHarness } from '@lab/harness';

import { env } from './env';
import { defaultModel, models } from './models';

export const harness = await openHarness({
  model: { provider: defaultModel.provider, modelId: defaultModel.modelId },
  models,
  onReport: (report) => console.error(report),
  path: env.LAB_STORAGE_PATH,
  searchApiKey: env.BRAVE_SEARCH_API_KEY,
});
