import type { AppType } from '@lab/server';
import {
  type ClientResponse,
  DetailedError,
  hc,
  parseResponse,
} from 'hono/client';
import { z } from 'zod';

import { authClient, origin } from './auth';

const errorSchema = z.object({ error: z.string() });

export const client = hc<AppType>(`${origin}/api`, {
  headers: async () => ({ cookie: await authClient.getCookie() }),
  init: { credentials: 'omit' },
});

export async function call<T extends ClientResponse<unknown>>(
  response: Promise<T>
) {
  try {
    return await parseResponse(response);
  } catch (error) {
    if (!(error instanceof DetailedError)) {
      throw error;
    }

    const body = errorSchema.safeParse(error.detail?.data);

    throw new Error(body.data?.error ?? error.message, { cause: error });
  }
}
