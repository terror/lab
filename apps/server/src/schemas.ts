import { MODEL_THINKING_LEVELS } from '@earendil-works/pi-ai/providers/model-schema';
import { z } from 'zod';

export const imageTypes = [
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

const MAX_ATTACHMENT_TEXT = 4_000_000;

const CHARS_PER_TOKEN = 4;

const CONTEXT_SHARE = 0.5;

const DEFAULT_CONTEXT_WINDOW = 100_000;

export function attachmentTextLimit(contextWindow: number | undefined) {
  return Math.min(
    MAX_ATTACHMENT_TEXT,
    Math.floor(
      (contextWindow ?? DEFAULT_CONTEXT_WINDOW) *
        CHARS_PER_TOKEN *
        CONTEXT_SHARE
    )
  );
}

export const attachmentSchema = z.discriminatedUnion('type', [
  z.object({
    data: z.base64().max(8_000_000),
    mimeType: z.enum(imageTypes),
    libraryId: z.number().int().positive().optional(),
    name: z.string().max(200),
    type: z.literal('image'),
  }),
  z.object({
    libraryId: z.number().int().positive().optional(),
    name: z.string().max(200),
    text: z.string().max(MAX_ATTACHMENT_TEXT),
    type: z.literal('file'),
    uploadId: z.uuid().optional(),
  }),
]);

export type Attachment = z.infer<typeof attachmentSchema>;

export const sortSchema = z.enum(['activity', 'created', 'title']);

export const thinkingLevelSchema = z.enum(MODEL_THINKING_LEVELS);
