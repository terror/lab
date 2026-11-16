import { fileURLToPath } from 'node:url';
import { z } from 'zod';

function list(fallback = '') {
  return z
    .string()
    .default(fallback)
    .transform((value) =>
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    );
}

const schema = z.object({
  AI_GATEWAY_API_KEY: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BRAVE_SEARCH_API_KEY: z.string().min(1).optional(),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  LAB_ADMIN_EMAIL: z.email(),
  LAB_ALLOWED_EMAILS: list().pipe(z.array(z.email())),
  LAB_HOST: z.string().min(1).default('127.0.0.1'),
  LAB_MODELS: list(
    'anthropic/claude-sonnet-5.5,anthropic/claude-haiku-5.5,anthropic/claude-opus-5.5'
  ),
  LAB_ORIGIN: z.url(),
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
