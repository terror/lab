import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { schema } from '@lab/db';
import { betterAuth } from 'better-auth';
import { eq, sql } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

import { db } from './db';
import { env } from './env';

export function isAdmin(email: string) {
  return email.toLowerCase() === env.LAB_ADMIN_EMAIL.toLowerCase();
}

async function admitted(email: string) {
  if (isAdmin(email)) {
    return true;
  }

  const normalized = email.toLowerCase();

  const [invited] = await db
    .select({ email: schema.invitation.email })
    .from(schema.invitation)
    .where(eq(schema.invitation.email, normalized))
    .limit(1);

  if (invited) {
    return true;
  }

  const [member] = await db
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(sql`lower(${schema.user.email})`, normalized))
    .limit(1);

  return member !== undefined;
}

export const auth = betterAuth({
  baseURL: env.LAB_ORIGIN,
  basePath: '/api/auth',
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  secret: env.BETTER_AUTH_SECRET,
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  user: {
    validateUserInfo: async ({ user }) => {
      if (user.email && (await admitted(user.email))) {
        return undefined;
      }

      return {
        error: 'not_allowed',
        errorDescription: 'This account is not allowed to use Lab.',
      };
    },
  },
});

export type User = typeof auth.$Infer.Session.user;

export const requireUser = createMiddleware<{ Variables: { user: User } }>(
  async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) {
      throw new HTTPException(401, { message: 'Sign in to use Lab' });
    }

    c.set('user', session.user);

    await next();
  }
);

export const requireAdmin = createMiddleware<{ Variables: { user: User } }>(
  async (c, next) => {
    if (!isAdmin(c.get('user').email)) {
      throw new HTTPException(403, { message: 'Only the admin can do this' });
    }

    await next();
  }
);
