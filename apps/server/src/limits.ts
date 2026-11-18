import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

import { type User, isAdmin } from './auth';

const MINUTE = 60_000;

const buckets = {
  connectors: 10,
  messages: 30,
  uploads: 30,
};

type Bucket = keyof typeof buckets;

const hits = new Map<string, number[]>();

function retryAfter(bucket: Bucket, user: User) {
  if (isAdmin(user)) {
    return undefined;
  }

  const key = `${bucket}:${user.id}`;

  const now = Date.now();

  const recent = (hits.get(key) ?? []).filter((at) => at > now - MINUTE);

  const [oldest] = recent;

  if (oldest !== undefined && recent.length >= buckets[bucket]) {
    return Math.max(1, Math.ceil((oldest + MINUTE - now) / 1000));
  }

  hits.set(key, [...recent, now]);

  return undefined;
}

function tooOften(seconds: number) {
  return new HTTPException(429, {
    message: `You’re doing that too often. Try again in ${seconds} seconds.`,
  });
}

export function checkRate(bucket: Bucket, user: User) {
  const seconds = retryAfter(bucket, user);

  if (seconds !== undefined) {
    throw tooOften(seconds);
  }
}

export function rateLimit(bucket: Bucket) {
  return createMiddleware<{ Variables: { user: User } }>(async (c, next) => {
    const seconds = retryAfter(bucket, c.get('user'));

    if (seconds !== undefined) {
      c.header('Retry-After', String(seconds));

      throw tooOften(seconds);
    }

    return next();
  });
}
