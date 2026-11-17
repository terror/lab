import { schema } from '@lab/db';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { deleteAccount, exportAccount } from './account';
import { isAdmin, requireUser } from './auth';
import { db } from './db';
import { rateLimit } from './limits';
import { imageTypes } from './schemas';
import { storeUpload } from './storage';
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
  .get('/', (c) => c.json({ admin: isAdmin(c.get('user')) }))
  .get('/export', async (c) => {
    c.header('content-disposition', 'attachment; filename="lab-export.json"');

    return c.json(await exportAccount(c.get('user')));
  })
  .delete('/', async (c) => {
    const user = c.get('user');

    if (isAdmin(user)) {
      throw new HTTPException(403, {
        message: 'The admin account can’t be deleted',
      });
    }

    await deleteAccount(user.id);

    return c.body(null, 204);
  })
  .put('/picture', rateLimit('uploads'), picture, async (c) => {
    const user = c.get('user');

    const { picture: file } = c.req.valid('form');

    const upload = await storeUpload(user.id, {
      content: new Uint8Array(await file.arrayBuffer()),
      mimeType: file.type,
    });

    const image = `/api/uploads/${upload}`;

    await setImage(user.id, image);

    return c.json({ image });
  })
  .delete('/picture', async (c) => {
    await setImage(c.get('user').id, null);

    return c.body(null, 204);
  });

export default profile;
