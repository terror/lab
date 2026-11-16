import type { Credential, CredentialStore } from '@earendil-works/pi-ai';
import { schema } from '@lab/db';
import { eq } from 'drizzle-orm';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

import { db } from './db';
import { env } from './env';

const table = schema.providerCredential;

const key = createHash('sha256')
  .update(`${env.BETTER_AUTH_SECRET}:provider-credentials`)
  .digest();

function seal(credential: Credential) {
  const iv = randomBytes(12);

  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const data = Buffer.concat([
    cipher.update(JSON.stringify(credential), 'utf8'),
    cipher.final(),
  ]);

  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

function open(sealed: string) {
  const bytes = Buffer.from(sealed, 'base64');

  const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));

  decipher.setAuthTag(bytes.subarray(12, 28));

  const json = Buffer.concat([
    decipher.update(bytes.subarray(28)),
    decipher.final(),
  ]).toString('utf8');

  return JSON.parse(json) as Credential;
}

function unseal(providerId: string, sealed: string) {
  try {
    return open(sealed);
  } catch {
    console.error(`Unable to decrypt the ${providerId} credential`);
    return undefined;
  }
}

const cache = new Map<string, Credential | undefined>();

async function read(providerId: string) {
  if (cache.has(providerId)) {
    return cache.get(providerId);
  }

  const [row] = await db
    .select({ credential: table.credential })
    .from(table)
    .where(eq(table.providerId, providerId));

  const credential = row && unseal(providerId, row.credential);

  cache.set(providerId, credential);

  return credential;
}

export const credentials: CredentialStore = {
  read,
  list: async () => {
    const rows = await db.select().from(table);

    return rows.flatMap(({ credential, providerId }) => {
      const type = unseal(providerId, credential)?.type;

      return type ? [{ providerId, type }] : [];
    });
  },
  modify: async (providerId, change) => {
    const next = await change(await read(providerId));

    if (next === undefined) {
      return read(providerId);
    }

    const credential = seal(next);

    await db
      .insert(table)
      .values({ credential, providerId })
      .onConflictDoUpdate({ set: { credential }, target: table.providerId });

    cache.set(providerId, next);

    return next;
  },
  delete: async (providerId) => {
    await db.delete(table).where(eq(table.providerId, providerId));

    cache.set(providerId, undefined);
  },
};
