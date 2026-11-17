import { schema } from '@lab/db';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { requireUser } from './auth';
import { db } from './db';
import { imageTypes } from './schemas';
import { validator } from './validator';

const PICTURE_BYTES = 5 * 1024 * 1024;

const picture = validator(
  'form',
  z.object({
    picture: z
      .instanceof(File)
      .refine(
        ({ size, type }) =>
          imageTypes.some((imageType) => imageType === type) &&
          size <= PICTURE_BYTES,
        'Choose a PNG, JPEG, GIF, or WebP image up to 5 MB'
      ),
  })
);

async function setImage(userId: string, image: string | null) {
  await db.update(schema.user).set({ image }).where(eq(schema.user.id, userId));
}

const profile = new Hono()
  .use(requireUser)
  .put('/picture', picture, async (c) => {
    const user = c.get('user');

    const { picture: file } = c.req.valid('form');

    const [upload] = await db
      .insert(schema.upload)
      .values({
        content: new Uint8Array(await file.arrayBuffer()),
        mimeType: file.type,
        ownerId: user.id,
      })
      .returning({ id: schema.upload.id });

    if (!upload) {
      throw new HTTPException(500, { message: 'Unable to save the picture' });
    }

    const image = `/api/uploads/${upload.id}`;

    await setImage(user.id, image);

    return c.json({ image });
  })
  .delete('/picture', async (c) => {
    await setImage(c.get('user').id, null);

    return c.body(null, 204);
  });

export default profile;
