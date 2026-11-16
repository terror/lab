import { schema } from '@lab/db';
import { asc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { isAdmin, requireAdmin, requireUser } from './auth';
import { db } from './db';
import { validator } from './validator';

const invite = validator(
  'json',
  z.object({ email: z.email().transform((email) => email.toLowerCase()) })
);

const emailParam = validator('param', z.object({ email: z.email() }));

const memberParam = validator('param', z.object({ id: z.string().min(1) }));

const members = new Hono()
  .use(requireUser)
  .use(requireAdmin)
  .get('/', async (c) => {
    const users = await db
      .select({
        email: schema.user.email,
        id: schema.user.id,
        image: schema.user.image,
        name: schema.user.name,
      })
      .from(schema.user)
      .orderBy(asc(schema.user.name));

    const invitations = await db
      .select({
        createdAt: schema.invitation.createdAt,
        email: schema.invitation.email,
      })
      .from(schema.invitation)
      .orderBy(asc(schema.invitation.email));

    const joined = new Set(users.map(({ email }) => email.toLowerCase()));

    return c.json({
      invitations: invitations.filter(({ email }) => !joined.has(email)),
      members: users.map((user) => ({ ...user, admin: isAdmin(user.email) })),
    });
  })
  .post('/invitations', invite, async (c) => {
    await db
      .insert(schema.invitation)
      .values({
        email: c.req.valid('json').email,
        invitedById: c.get('user').id,
      })
      .onConflictDoNothing();

    return c.body(null, 204);
  })
  .delete('/invitations/:email', emailParam, async (c) => {
    await db
      .delete(schema.invitation)
      .where(
        eq(schema.invitation.email, c.req.valid('param').email.toLowerCase())
      );

    return c.body(null, 204);
  })
  .delete('/:id', memberParam, async (c) => {
    const { id } = c.req.valid('param');

    if (id === c.get('user').id) {
      throw new HTTPException(400, { message: 'You cannot remove yourself' });
    }

    const [removed] = await db
      .delete(schema.user)
      .where(eq(schema.user.id, id))
      .returning({ email: schema.user.email });

    if (removed) {
      await db
        .delete(schema.invitation)
        .where(eq(schema.invitation.email, removed.email.toLowerCase()));
    }

    return c.body(null, 204);
  });

export default members;
