import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { schema } from '@lab/db';
import { betterAuth } from 'better-auth';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

import { db } from './db';
import { env } from './env';

export function isAdmin({ email }: { email?: string | null }) {
  return email?.toLowerCase() === env.LAB_ADMIN_EMAIL.toLowerCase();
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
    validateUserInfo: ({ user }) => {
      if (isAdmin(user)) {
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
