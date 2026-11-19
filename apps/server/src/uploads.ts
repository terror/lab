import { schema } from '@lab/db';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { requireUser } from './auth';
import { db } from './db';
import { fileHeaders } from './file-headers';
import { found } from './found';
import { rateLimit } from './limits';
import { storeUpload } from './storage';
import { BODY_BYTES, uuidParam, validator } from './validator';

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
  }),
  MAX_DOCUMENT_BYTES + MAX_THUMBNAIL_BYTES + BODY_BYTES
);

async function bytes(file: File) {
  return new Uint8Array(await file.arrayBuffer());
}

async function owned(id: string, ownerId: string) {
  const [row] = await db
    .select({
      content: schema.upload.content,
      mimeType: schema.upload.mimeType,
      thumbnail: schema.upload.thumbnail,
    })
    .from(schema.upload)
    .where(and(eq(schema.upload.id, id), eq(schema.upload.ownerId, ownerId)));

  return row;
}

const uploads = new Hono()
  .use(requireUser)
  .get('/:id', uuidParam, async (c) => {
    const upload = found(
      await owned(c.req.valid('param').id, c.get('user').id),
      'Upload not found'
    );

    return c.body(
      new Uint8Array(upload.content),
      200,
      fileHeaders(upload.mimeType)
    );
  })
  .get('/:id/thumbnail', uuidParam, async (c) => {
    const thumbnail = found(
      (await owned(c.req.valid('param').id, c.get('user').id))?.thumbnail,
      'Thumbnail not found'
    );

    return c.body(new Uint8Array(thumbnail), 200, fileHeaders('image/png'));
  })
  .post('/', rateLimit('uploads'), form, async (c) => {
    const { document, thumbnail } = c.req.valid('form');

    const id = await storeUpload(c.get('user').id, {
      content: await bytes(document),
      mimeType: document.type,
      thumbnail: thumbnail ? await bytes(thumbnail) : null,
    });

    return c.json({ id }, 201);
  });

export default uploads;
