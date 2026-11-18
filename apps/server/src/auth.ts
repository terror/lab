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

export function allowed(user: {
  email?: string | null;
  emailVerified?: boolean;
}) {
  return (
    user.emailVerified === true &&
    (isAdmin(user) ||
      (typeof user.email === 'string' &&
        emailAllowed(user.email, env.LAB_ALLOWED_EMAILS)))
  );
}

const NOT_ALLOWED = 'This account is not allowed to use Lab.';

const origin = new URL(env.LAB_ORIGIN).origin;

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

function fromElsewhere(request: Request) {
  if (safeMethods.has(request.method)) {
    return false;
  }

  const site = request.headers.get('sec-fetch-site');

  const sender = request.headers.get('origin');

  return (
    (site !== null && site !== 'same-origin') ||
    (sender !== null && sender !== origin)
  );
}

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
  trustedOrigins: ['com.scalzulli.lab://'],
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
    if (fromElsewhere(c.req.raw)) {
      throw new HTTPException(403, {
        message: 'This request came from another site',
      });
    }

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
