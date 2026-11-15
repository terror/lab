import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const schema = z.object({
  AI_GATEWAY_API_KEY: z.string().min(1),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  LAB_HOST: z.string().min(1).default('127.0.0.1'),
  LAB_MODELS: z
    .string()
    .default(
      'anthropic/claude-sonnet-5.5,anthropic/claude-haiku-5.5,anthropic/claude-opus-5.5'
    )
    .transform((value) =>
      value
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    ),
  LAB_STORAGE_PATH: z
    .string()
    .min(1)
    .default(fileURLToPath(new URL('../../../lab.sqlite', import.meta.url))),
});

const result = schema.safeParse(process.env);

if (!result.success) {
  throw new Error(
    `Invalid environment variables:\n${z.prettifyError(result.error)}`
  );
}

export const env = result.data;
