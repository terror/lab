import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { schema } from '@lab/db';
import { betterAuth } from 'better-auth';
import { testUtils } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';

import { db } from '../src/db';
import { env } from '../src/env';

const auth = betterAuth({
  baseURL: env.LAB_ORIGIN,
  basePath: '/api/auth',
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  plugins: [testUtils()],
  secret: env.BETTER_AUTH_SECRET,
});

export async function signIn(user = { emailVerified: true }) {
  const { test } = await auth.$context;

  const saved = await test.saveUser(test.createUser(user));

  return test.getAuthHeaders({ userId: saved.id });
}

export async function signInAdmin() {
  const { test } = await auth.$context;

  const [existing] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, env.LAB_ADMIN_EMAIL));

  const user =
    existing ??
    (await test.saveUser(
      test.createUser({ email: env.LAB_ADMIN_EMAIL, emailVerified: true })
    ));

  return test.getAuthHeaders({ userId: user.id });
}
