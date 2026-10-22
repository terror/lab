import { APIError } from 'better-auth/api';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { auth } from './auth';

export const workspaceIdSchema = z.uuid().nullable().default(null);

export type Principal = {
  userId: string;
  headers: Headers;
};

export type Ownership = {
  ownerId: string;
  workspaceId: string | null;
};

export type Api = {
  Variables: { principal: Principal };
};

export async function principal(request: Request): Promise<Principal> {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session) {
    throw new HTTPException(401, { message: 'Unauthorized' });
  }

  return { userId: session.user.id, headers: request.headers };
}

export const authenticate = createMiddleware<Api>(async (c, next) => {
  c.set('principal', await principal(c.req.raw));
  await next();
});

export async function authorize(principal: Principal, ownership: Ownership) {
  if (ownership.workspaceId === null) {
    if (ownership.ownerId !== principal.userId) {
      throw new HTTPException(404, { message: 'Not found' });
    }

    return;
  }

  try {
    await auth.api.getActiveMemberRole({
      headers: principal.headers,
      query: { organizationId: ownership.workspaceId },
    });
  } catch (error) {
    if (error instanceof APIError && error.statusCode === 403) {
      throw new HTTPException(404, { message: 'Not found' });
    }

    throw error;
  }
}
