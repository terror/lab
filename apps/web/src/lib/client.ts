import type { AppType } from '@lab/server';
import {
  type ClientResponse,
  DetailedError,
  hc,
  parseResponse,
} from 'hono/client';
import { z } from 'zod';

const errorSchema = z.object({ error: z.string() });

export const client = hc<AppType>(`${window.location.origin}/api`);

export async function call<T extends ClientResponse<unknown>>(
  response: Promise<T>
) {
  try {
    return await parseResponse(response);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        'Couldn’t reach Lab. Check your connection and try again.',
        {
          cause: error,
        }
      );
    }

    if (!(error instanceof DetailedError)) {
      throw error;
    }

    const body = errorSchema.safeParse(error.detail?.data);

    throw new Error(body.data?.error ?? 'Something went wrong. Try again.', {
      cause: error,
    });
  }
}

export async function callIfFound<T extends ClientResponse<unknown>>(
  response: Promise<T>
) {
  try {
    return await call(response);
  } catch (error) {
    if (
      error instanceof Error &&
      error.cause instanceof DetailedError &&
      error.cause.statusCode === 404
    ) {
      return null;
    }

    throw error;
  }
}
