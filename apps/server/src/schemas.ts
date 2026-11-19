import { MODEL_THINKING_LEVELS } from '@earendil-works/pi-ai/providers/model-schema';
import { PLAN_LIMIT, PLAN_STATUSES, STEP_LENGTH } from '@lab/harness/plan';
import {
  CHAT_SORTS,
  PERSONALITIES,
  SYNTAX_THEMES,
  type Preferences,
  THEMES,
} from '@lab/harness/preferences';

export {
  PLAN_LIMIT,
  PLAN_STATUSES,
  STEP_LENGTH,
  type Plan,
  type PlanStatus,
  type PlanStep,
} from '@lab/harness/plan';
export { defaultPreferences } from '@lab/harness/preferences';
import { z } from 'zod';

export const imageTypes = [
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const MAX_ATTACHMENT_TEXT = 4_000_000;

export const MAX_IMAGE_DATA = 8_000_000;

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
    data: z.base64().max(MAX_IMAGE_DATA),
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

export const sortSchema = z.enum(CHAT_SORTS);

export const HINT_LIMIT = 100;

export const preferencesSchema = z.object({
  chatSort: sortSchema,
  hints: z.array(z.string().min(1).max(64)).max(HINT_LIMIT),
  lineNumbers: z.boolean(),
  personality: z.enum(PERSONALITIES),
  syntaxTheme: z.enum(SYNTAX_THEMES),
  theme: z.enum(THEMES),
}) satisfies z.ZodType<Preferences>;

export const thinkingLevelSchema = z.enum(MODEL_THINKING_LEVELS);

export const modelSchema = z.object({
  id: z.string().min(1),
  provider: z.string().min(1),
  thinkingLevel: thinkingLevelSchema.optional(),
});

export const planStepsSchema = z
  .array(
    z.object({
      status: z.enum(PLAN_STATUSES),
      text: z.string().trim().min(1).max(STEP_LENGTH),
    })
  )
  .max(PLAN_LIMIT);
