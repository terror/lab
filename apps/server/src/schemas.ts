import { MODEL_THINKING_LEVELS } from '@earendil-works/pi-ai/providers/model-schema';
import { z } from 'zod';

export const imageTypes = [
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const attachmentSchema = z.discriminatedUnion('type', [
  z.object({
    data: z.base64().max(8_000_000),
    mimeType: z.enum(imageTypes),
    name: z.string().max(200),
    type: z.literal('image'),
  }),
  z.object({
    name: z.string().max(200),
    text: z.string().max(200_000),
    type: z.literal('file'),
  }),
]);

export type Attachment = z.infer<typeof attachmentSchema>;

export const sortSchema = z.enum(['activity', 'created', 'title']);

export const thinkingLevelSchema = z.enum(MODEL_THINKING_LEVELS);
