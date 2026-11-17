import { schema } from '@lab/db';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { requireUser } from './auth';
import { db } from './db';
import { fileHeaders } from './file-headers';
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

const params = validator('param', z.object({ id: z.uuid() }));

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
  .get('/:id', params, async (c) => {
    const upload = await owned(c.req.valid('param').id, c.get('user').id);

    if (!upload) {
      throw new HTTPException(404, { message: 'Upload not found' });
    }

    return c.body(
      new Uint8Array(upload.content),
      200,
      fileHeaders(upload.mimeType)
    );
  })
  .get('/:id/thumbnail', params, async (c) => {
    const upload = await owned(c.req.valid('param').id, c.get('user').id);

    if (!upload?.thumbnail) {
      throw new HTTPException(404, { message: 'Thumbnail not found' });
    }

    return c.body(
      new Uint8Array(upload.thumbnail),
      200,
      fileHeaders('image/png')
    );
  })
  .post('/', form, async (c) => {
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
