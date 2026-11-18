import type { ConversationId } from '@earendil-works/pi-durable';
import { schema } from '@lab/db';
import type { ImageAccess } from '@lab/harness';
import { getTableName, sql } from 'drizzle-orm';
import { z } from 'zod';

import { credentials } from './credentials';
import { db } from './db';
import { env } from './env';
import { recordUsage } from './helper-usage';
import { libraryAccess } from './library-access';
import { requireOwner } from './records';
import { imageTypes } from './schemas';
import { checkSpend } from './spend';
import { storeUpload } from './storage';

const GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1';

const PROVIDER = 'vercel-ai-gateway';

const NOT_CONFIGURED =
  "Image generation isn't set up. The user can add a Vercel AI Gateway key in Settings → Providers.";

const extensions: Record<(typeof imageTypes)[number], string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const completionSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string().nullish(),
        images: z
          .array(z.object({ image_url: z.object({ url: z.string() }) }))
          .default([]),
      }),
    })
  ),
  usage: z
    .object({
      completion_tokens: z.number(),
      cost: z.number().optional(),
      prompt_tokens: z.number(),
    })
    .optional(),
});

const errorSchema = z.object({ error: z.object({ message: z.string() }) });

const catalogSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      pricing: z
        .object({
          image: z.coerce.number().optional(),
          image_dimension_quality_pricing: z
            .array(
              z.object({ cost: z.coerce.number(), size: z.string().optional() })
            )
            .optional(),
        })
        .optional(),
    })
  ),
});

async function gatewayKey() {
  const credential = await credentials.read(PROVIDER);

  return credential?.type === 'api_key' ? credential.key : undefined;
}

async function complete(
  key: string,
  prompt: string,
  sources: string[],
  signal: AbortSignal | undefined
) {
  const response = await fetch(`${GATEWAY_URL}/chat/completions`, {
    body: JSON.stringify({
      messages: [
        {
          content: [
            { text: prompt, type: 'text' },
            ...sources.map((url) => ({
              image_url: { url },
              type: 'image_url',
            })),
          ],
          role: 'user',
        },
      ],
      modalities: ['text', 'image'],
      model: env.LAB_IMAGE_MODEL,
    }),
    headers: {
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    method: 'POST',
    signal: AbortSignal.any([
      AbortSignal.timeout(120_000),
      ...(signal ? [signal] : []),
    ]),
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      'The Vercel AI Gateway rejected the API key. The user can update it in Settings → Providers.'
    );
  }

  if (!response.ok) {
    const message = errorSchema.safeParse(
      await response.json().catch(() => null)
    ).data?.error.message;

    throw new Error(
      `Image generation failed (${response.status})${message ? `: ${message}` : '.'}`
    );
  }

  return completionSchema.parse(await response.json());
}

async function catalogPrice(model: string) {
  const response = await fetch(`${GATEWAY_URL}/models`, {
    signal: AbortSignal.timeout(10_000),
  });

  const pricing = catalogSchema
    .parse(await response.json())
    .data.find(({ id }) => id === model)?.pricing;

  return (
    pricing?.image ??
    pricing?.image_dimension_quality_pricing?.find(
      ({ size }) => size === 'default'
    )?.cost ??
    0
  );
}

function decode(url: string | undefined) {
  const [, type, data] = /^data:([^;,]+);base64,(.+)$/s.exec(url ?? '') ?? [];

  const mimeType = z.enum(imageTypes).safeParse(type).data;

  return mimeType && data ? { data, mimeType } : undefined;
}

async function reserveLibraryId() {
  const [reserved] = await db.execute<{ id: number }>(
    sql`select nextval(pg_get_serial_sequence(${getTableName(schema.libraryItem)}, 'id'))::int as id`
  );

  if (!reserved) {
    throw new Error('Unable to save the image');
  }

  return reserved.id;
}

async function source(conversationId: ConversationId, id: number) {
  const content = await libraryAccess.read(conversationId, id);

  if (content?.kind !== 'image') {
    throw new Error(`No library image has the id ${id}.`);
  }

  return `data:${content.mimeType};base64,${content.data}`;
}

export const imageAccess: ImageAccess = {
  available: async () => (await gatewayKey()) !== undefined,
  generate: async (conversationId, { images, name, prompt }, signal) => {
    const key = await gatewayKey();

    if (!key) {
      throw new Error(NOT_CONFIGURED);
    }

    const ownerId = await requireOwner(conversationId);

    await checkSpend(ownerId);

    const sources = await Promise.all(
      images.map((id) => source(conversationId, id))
    );

    const { choices, usage } = await complete(key, prompt, sources, signal);

    const message = choices[0]?.message;

    const returned = message?.images ?? [];

    const cost =
      usage?.cost ??
      (await catalogPrice(env.LAB_IMAGE_MODEL).catch(() => 0)) *
        returned.length;

    await recordUsage(conversationId, {
      cacheRead: 0,
      cacheWrite: 0,
      cost,
      createdAt: new Date(),
      input: usage?.prompt_tokens ?? 0,
      kind: 'image',
      model: env.LAB_IMAGE_MODEL,
      output: usage?.completion_tokens ?? 0,
      provider: PROVIDER,
    });

    const image = decode(returned[0]?.image_url.url);

    if (!image) {
      throw new Error(
        `The image model returned no image${message?.content ? `: ${message.content}` : '.'}`
      );
    }

    const content = Uint8Array.fromBase64(image.data);

    const uploadId = await storeUpload(ownerId, {
      content,
      mimeType: image.mimeType,
    });

    return {
      data: image.data,
      libraryId: await reserveLibraryId(),
      mimeType: image.mimeType,
      name: `${name.replace(/\.(gif|jpe?g|png|webp)$/i, '')}.${extensions[image.mimeType]}`,
      size: content.byteLength,
      uploadId,
    };
  },
};
