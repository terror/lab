import { schema } from '@lab/db';
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import {
  OAuthClientInformationFullSchema,
  OAuthClientInformationSchema,
  OAuthTokensSchema,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { openSecret, sealSecret } from './credentials';
import { db } from './db';
import { env } from './env';

const table = schema.connectorAuth;

const stateSchema = z.object({
  client: z.unknown().optional(),
  nonce: z.string().optional(),
  tokens: z.unknown().optional(),
  verifier: z.string().optional(),
});

type AuthState = z.infer<typeof stateSchema>;

export const redirectUrl = new URL('/api/connectors/callback', env.LAB_ORIGIN)
  .href;

export const clientMetadataUrl = new URL(
  '/api/connectors/client-metadata.json',
  env.LAB_ORIGIN
).href;

export const clientMetadata = {
  client_name: 'Lab',
  grant_types: ['authorization_code', 'refresh_token'],
  redirect_uris: [redirectUrl],
  response_types: ['code'],
  token_endpoint_auth_method: 'none',
};

async function load(connectorId: number): Promise<AuthState> {
  const [row] = await db
    .select({ state: table.state })
    .from(table)
    .where(eq(table.connectorId, connectorId));

  return (row && stateSchema.safeParse(openSecret(row.state)).data) ?? {};
}

async function save(connectorId: number, change: AuthState) {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ state: table.state })
      .from(table)
      .where(eq(table.connectorId, connectorId))
      .for('update');

    const current =
      (row && stateSchema.safeParse(openSecret(row.state)).data) ?? {};

    const state = sealSecret({ ...current, ...change });

    await tx
      .insert(table)
      .values({ connectorId, state })
      .onConflictDoUpdate({ set: { state }, target: table.connectorId });
  });
}

function client(value: unknown) {
  return (
    OAuthClientInformationFullSchema.safeParse(value).data ??
    OAuthClientInformationSchema.safeParse(value).data
  );
}

export async function connectorIssuer(connectorId: number) {
  return client((await load(connectorId)).client)?.issuer;
}

export function stateConnector(state: string) {
  const id = Number(state.split('.')[0]);

  return Number.isInteger(id) && id > 0 ? id : undefined;
}

export async function checkState(connectorId: number, state: string) {
  const { nonce } = await load(connectorId);

  return nonce !== undefined && state === `${connectorId}.${nonce}`;
}

export async function finishAuthorization(connectorId: number) {
  await save(connectorId, { nonce: undefined, verifier: undefined });
}

export function connectorAuth(
  connectorId: number,
  onRedirect?: (url: URL) => void
): OAuthClientProvider {
  const interactive = onRedirect !== undefined;

  return {
    clientInformation: async () => client((await load(connectorId)).client),
    clientMetadata,
    ...(new URL(env.LAB_ORIGIN).protocol === 'https:' && { clientMetadataUrl }),
    codeVerifier: async () => {
      const { verifier } = await load(connectorId);

      if (!verifier) {
        throw new Error('Start signing in to this connector again.');
      }

      return verifier;
    },
    invalidateCredentials: async (scope) => {
      const cleared: Record<typeof scope, AuthState> = {
        all: {
          client: undefined,
          nonce: undefined,
          tokens: undefined,
          verifier: undefined,
        },
        client: { client: undefined },
        discovery: {},
        tokens: { tokens: undefined },
        verifier: { verifier: undefined },
      };

      await save(connectorId, cleared[scope]);
    },
    redirectToAuthorization: onRedirect ?? (() => undefined),
    redirectUrl,
    saveClientInformation: (information) =>
      save(connectorId, { client: information }),
    saveCodeVerifier: async (verifier) => {
      if (interactive) {
        await save(connectorId, { verifier });
      }
    },
    saveTokens: (tokens) => save(connectorId, { tokens }),
    state: async () => {
      const nonce = randomUUID();

      if (interactive) {
        await save(connectorId, { nonce });
      }

      return `${connectorId}.${nonce}`;
    },
    tokens: async () =>
      OAuthTokensSchema.safeParse((await load(connectorId)).tokens).data,
  };
}
