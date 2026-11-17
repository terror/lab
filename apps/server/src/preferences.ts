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

async function current() {
  return (
    (await harness.snapshot(PreferencesDoc, BACKGROUND_CONTEXT)) ??
    defaultPreferences
  );
}

const preferences = new Hono()
  .use(requireUser)
  .get('/', async (c) => c.json({ preferences: await current() }))
  .patch('/', change, async (c) => {
    await harness.commit(async (tx) => {
      Object.assign(await tx.doc(PreferencesDoc), c.req.valid('json'));
    }, BACKGROUND_CONTEXT);

    return c.json({ preferences: await current() });
  });

export default preferences;
