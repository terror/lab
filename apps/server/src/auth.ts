import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { expo } from '@better-auth/expo';
import { schema } from '@lab/db';
import { betterAuth } from 'better-auth';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

import { db } from './db';
import { env } from './env';

export function isAdmin({ email }: { email?: string | null }) {
  return email?.toLowerCase() === env.LAB_ADMIN_EMAIL.toLowerCase();
}

export function emailAllowed(email: string, patterns: readonly string[]) {
  const lower = email.toLowerCase();

  return patterns.some(
    (pattern) =>
      pattern === '*' ||
      pattern === lower ||
      (pattern.startsWith('*@') && lower.endsWith(pattern.slice(1)))
  );
}

function allowed(user: { email?: string | null; emailVerified?: boolean }) {
  return (
    isAdmin(user) ||
    (user.emailVerified === true &&
      typeof user.email === 'string' &&
      emailAllowed(user.email, env.LAB_ALLOWED_EMAILS))
  );
}

const NOT_ALLOWED = 'This account is not allowed to use Lab.';

export const auth = betterAuth({
  baseURL: env.LAB_ORIGIN,
  basePath: '/api/auth',
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  plugins: [expo()],
  secret: env.BETTER_AUTH_SECRET,
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  trustedOrigins: ['lab://'],
  user: {
    validateUserInfo: ({ user }) => {
      if (allowed(user)) {
        return undefined;
      }

      return {
        error: 'not_allowed',
        errorDescription: NOT_ALLOWED,
      };
    },
  },
});

export type User = typeof auth.$Infer.Session.user;

export const requireAdmin = createMiddleware<{ Variables: { user: User } }>(
  async (c, next) => {
    if (!isAdmin(c.get('user'))) {
      throw new HTTPException(403, { message: 'Only the admin can do this' });
    }

    await next();
  }
);

export const requireUser = createMiddleware<{ Variables: { user: User } }>(
  async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    if (!session) {
      throw new HTTPException(401, { message: 'Sign in to use Lab' });
    }

    if (!allowed(session.user)) {
      throw new HTTPException(403, { message: NOT_ALLOWED });
    }

    c.set('user', session.user);

    await next();
  }
);
