import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { PreferencesDoc } from '@lab/harness';
import { defaultPreferences } from '@lab/harness/preferences';
import { Hono } from 'hono';

import { requireUser } from './auth';
import { harness } from './harness';
import { preferencesSchema } from './schemas';
import { validator } from './validator';

const change = validator(
  'json',
  preferencesSchema
    .partial()
    .refine(
      (value) => Object.values(value).some((field) => field !== undefined),
      'Nothing to change'
    )
);

async function current(ownerId: string) {
  return {
    ...defaultPreferences,
    ...(await harness.snapshot(PreferencesDoc, ownerId, BACKGROUND_CONTEXT)),
  };
}

const preferences = new Hono()
  .use(requireUser)
  .get('/', async (c) =>
    c.json({ preferences: await current(c.get('user').id) })
  )
  .patch('/', change, async (c) => {
    const { hints, ...settings } = c.req.valid('json');

    await harness.commit(async (tx) => {
      const doc = await tx.doc(PreferencesDoc, c.get('user').id, null);

      Object.assign(doc, settings);

      if (hints) {
        doc.hints = [...new Set([...(doc.hints ?? []), ...hints])];
      }
    }, BACKGROUND_CONTEXT);

    return c.json({ preferences: await current(c.get('user').id) });
  });

export default preferences;
