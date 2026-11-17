import { schema } from '@lab/db';
import { Hono } from 'hono';
import { z } from 'zod';

import { requireUser } from './auth';
import { db } from './db';
import { validator } from './validator';

const MAX_DOCUMENT_BYTES = 20_000_000;

const MAX_THUMBNAIL_BYTES = 1_000_000;

const form = validator(
  'form',
  z.object({
    document: z
      .instanceof(File)
      .refine(
        ({ size, type }) =>
          type === 'application/pdf' && size <= MAX_DOCUMENT_BYTES,
        'Upload a PDF up to 20 MB'
      ),
    thumbnail: z
      .instanceof(File)
      .refine(
        ({ size, type }) => type === 'image/png' && size <= MAX_THUMBNAIL_BYTES,
        'Thumbnails must be PNG images up to 1 MB'
      )
      .optional(),
  })
);

async function bytes(file: File) {
  return new Uint8Array(await file.arrayBuffer());
}

const uploads = new Hono().use(requireUser).post('/', form, async (c) => {
  const { document, thumbnail } = c.req.valid('form');

  const [created] = await db
    .insert(schema.upload)
    .values({
      content: await bytes(document),
      mimeType: document.type,
      ownerId: c.get('user').id,
      thumbnail: thumbnail ? await bytes(thumbnail) : null,
    })
    .returning({ id: schema.upload.id });

  return c.json({ id: created?.id ?? '' }, 201);
});

export default uploads;
