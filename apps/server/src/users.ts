import { schema } from '@lab/db';
import { asc } from 'drizzle-orm';
import { Hono } from 'hono';

import { requireUser } from './auth';
import { db } from './db';

const users = new Hono().use(requireUser).get('/', async (c) => {
  const rows = await db
    .select({
      email: schema.user.email,
      id: schema.user.id,
      image: schema.user.image,
      name: schema.user.name,
    })
    .from(schema.user)
    .orderBy(asc(schema.user.name));

  return c.json({ users: rows });
});

export default users;
