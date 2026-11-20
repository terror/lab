import { BACKGROUND_CONTEXT } from '@earendil-works/chord/context';
import { PreferencesDoc } from '@lab/harness';
import { defaultPreferences } from '@lab/harness/preferences';
import { Hono } from 'hono';
import { z } from 'zod';

import { requireUser } from './auth';
import { harness } from './harness';
import { HINT_LIMIT, preferencesSchema } from './schemas';
import { validator } from './validator';

const change = validator(
  'json',
  preferencesSchema
    .omit({ hints: true })
    .partial()
    .refine(
      (value) => Object.values(value).some((field) => field !== undefined),
      'Nothing to change'
    )
);

const hint = validator('json', z.object({ id: z.string().min(1).max(64) }));

async function current(ownerId: string) {
  return {
    ...defaultPreferences,
    ...(await harness().snapshot(PreferencesDoc, ownerId, BACKGROUND_CONTEXT)),
  };
}

const preferences = new Hono()
  .use(requireUser)
  .get('/', async (c) =>
    c.json({ preferences: await current(c.get('user').id) })
  )
  .patch('/', change, async (c) => {
    await harness().commit(async (tx) => {
      Object.assign(
        await tx.doc(PreferencesDoc, c.get('user').id, null),
        c.req.valid('json')
      );
    }, BACKGROUND_CONTEXT);

    return c.json({ preferences: await current(c.get('user').id) });
  })
  .post('/hints', hint, async (c) => {
    const { id } = c.req.valid('json');

    const fresh = await harness().commit(async (tx) => {
      const doc = await tx.doc(PreferencesDoc, c.get('user').id, null);

      const seen = doc.hints ?? [];

      if (
        doc.personality === 'quiet' ||
        seen.includes(id) ||
        seen.length >= HINT_LIMIT
      ) {
        return false;
      }

      doc.hints = [...seen, id];

      return true;
    }, BACKGROUND_CONTEXT);

    return c.json({ fresh, preferences: await current(c.get('user').id) });
  });

export default preferences;
