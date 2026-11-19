import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

import { type User, isAdmin } from './auth';

const MINUTE = 60_000;

const buckets = {
  asks: 10,
  computer: 30,
  connectors: 10,
  messages: 30,
  uploads: 30,
};

const hits = new Map<string, number[]>();

export function rateLimit(bucket: keyof typeof buckets) {
  return createMiddleware<{ Variables: { user: User } }>(async (c, next) => {
    const user = c.get('user');

    if (isAdmin(user)) {
      return next();
    }

    const key = `${bucket}:${user.id}`;

    const now = Date.now();

    const recent = (hits.get(key) ?? []).filter((at) => at > now - MINUTE);

    const [oldest] = recent;

    if (oldest !== undefined && recent.length >= buckets[bucket]) {
      const seconds = Math.max(1, Math.ceil((oldest + MINUTE - now) / 1000));

      c.header('Retry-After', String(seconds));

      throw new HTTPException(429, {
        message: `You’re doing that too often. Try again in ${seconds} seconds.`,
      });
    }

    hits.set(key, [...recent, now]);

    return next();
  });
}
