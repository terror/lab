import type { Credential, CredentialStore } from '@earendil-works/pi-ai';
import { schema } from '@lab/db';
import { and, eq } from 'drizzle-orm';
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

type Binding = `connector:${number}` | `provider:${string}`;

const VERSION = 'v2:';

export function seal(value: unknown, key: Buffer, binding: Binding) {
  const iv = randomBytes(12);

  const cipher = createCipheriv('aes-256-gcm', key, iv);

  cipher.setAAD(Buffer.from(binding));

  const data = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]);

  return `${VERSION}${Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64')}`;
}

function decrypt(sealed: string, key: Buffer, binding: Binding) {
  const bound = sealed.startsWith(VERSION);

  const bytes = Buffer.from(
    bound ? sealed.slice(VERSION.length) : sealed,
    'base64'
  );

  const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));

  if (bound) {
    decipher.setAAD(Buffer.from(binding));
  }

  decipher.setAuthTag(bytes.subarray(12, 28));

  return Buffer.concat([
    decipher.update(bytes.subarray(28)),
    decipher.final(),
  ]).toString('utf8');
}

export function unsealWith(
  sealed: string,
  binding: Binding,
  candidates: readonly Buffer[]
) {
  for (const [index, key] of candidates.entries()) {
    try {
      return {
        stale: index > 0 || !sealed.startsWith(VERSION),
        value: JSON.parse(decrypt(sealed, key, binding)) as unknown,
      };
    } catch {
      continue;
    }
  }

  return undefined;
}

export function sealSecret(value: unknown, binding: Binding) {
  return seal(value, current, binding);
}

export function openSecret(sealed: string, binding: Binding) {
  return unsealWith(sealed, binding, keys)?.value;
}

function resealed(sealed: string, binding: Binding) {
  const opened = unsealWith(sealed, binding, keys);

  return opened?.stale ? seal(opened.value, current, binding) : undefined;
}

export async function resealSecrets() {
  const auth = schema.connectorAuth;

  const [providers, connectors] = await Promise.all([
    db.select({ id: table.providerId, sealed: table.credential }).from(table),
    db.select({ id: auth.connectorId, sealed: auth.state }).from(auth),
  ]);

  for (const { id, sealed } of providers) {
    const credential = resealed(sealed, `provider:${id}`);

    if (credential) {
      await db
        .update(table)
        .set({ credential })
        .where(and(eq(table.providerId, id), eq(table.credential, sealed)));
    }
  }

  for (const { id, sealed } of connectors) {
    const state = resealed(sealed, `connector:${id}`);

    if (state) {
      await db
        .update(auth)
        .set({ state })
        .where(and(eq(auth.connectorId, id), eq(auth.state, sealed)));
    }
  }
}

function unseal(providerId: string, sealed: string) {
  const opened = unsealWith(sealed, `provider:${providerId}`, keys);

  if (!opened) {
    console.error(`Unable to decrypt the ${providerId} credential`);
  }

  return (
    opened && { credential: opened.value as Credential, stale: opened.stale }
  );
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
      .set({ credential: seal(credential, current, `provider:${providerId}`) })
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

    const credential = seal(next, current, `provider:${providerId}`);

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
