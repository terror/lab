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

export function deriveKey(secret: string) {
  return createHash('sha256').update(`${secret}:provider-credentials`).digest();
}

type Secrets = Pick<
  typeof env,
  'BETTER_AUTH_SECRET' | 'LAB_CREDENTIALS_KEY' | 'LAB_CREDENTIALS_KEY_PREVIOUS'
>;

export function keyring(secrets: Secrets) {
  const current = deriveKey(
    secrets.LAB_CREDENTIALS_KEY ?? secrets.BETTER_AUTH_SECRET
  );

  const older = [
    secrets.LAB_CREDENTIALS_KEY_PREVIOUS,
    secrets.BETTER_AUTH_SECRET,
  ].flatMap((secret) => (secret ? [deriveKey(secret)] : []));

  return { current, keys: [current, ...older] };
}

const { current, keys } = keyring(env);

function encrypt(text: string, key: Buffer) {
  const iv = randomBytes(12);

  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);

  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}

function decrypt(sealed: string, key: Buffer) {
  const bytes = Buffer.from(sealed, 'base64');

  const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));

  decipher.setAuthTag(bytes.subarray(12, 28));

  return Buffer.concat([
    decipher.update(bytes.subarray(28)),
    decipher.final(),
  ]).toString('utf8');
}

export function seal(credential: Credential, key: Buffer) {
  return encrypt(JSON.stringify(credential), key);
}

function open(sealed: string, key: Buffer) {
  return JSON.parse(decrypt(sealed, key)) as Credential;
}

export function sealSecret(value: unknown) {
  return encrypt(JSON.stringify(value), current);
}

export function openSecret(sealed: string): unknown {
  for (const key of keys) {
    try {
      return JSON.parse(decrypt(sealed, key));
    } catch {
      continue;
    }
  }

  return undefined;
}

export function unsealWith(sealed: string, candidates: readonly Buffer[]) {
  for (const [index, key] of candidates.entries()) {
    try {
      return { credential: open(sealed, key), stale: index > 0 };
    } catch {
      continue;
    }
  }

  return undefined;
}

function unseal(providerId: string, sealed: string) {
  const opened = unsealWith(sealed, keys);

  if (!opened) {
    console.error(`Unable to decrypt the ${providerId} credential`);
  }

  return opened;
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

  const opened = row && unseal(providerId, row.credential);

  const credential = opened?.credential;

  if (opened?.stale && credential) {
    await db
      .update(table)
      .set({ credential: seal(credential, current) })
      .where(eq(table.providerId, providerId));
  }

  cache.set(providerId, credential);

  return credential;
}

export const credentials: CredentialStore = {
  read,
  list: async () => {
    const rows = await db.select().from(table);

    return rows.flatMap(({ credential, providerId }) => {
      const type = unseal(providerId, credential)?.credential.type;

      return type ? [{ providerId, type }] : [];
    });
  },
  modify: async (providerId, change) => {
    const next = await change(await read(providerId));

    if (next === undefined) {
      return read(providerId);
    }

    const credential = seal(next, current);

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
