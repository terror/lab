import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const schema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  LAB_ADMIN_EMAIL: z.email(),
  LAB_DEFAULT_MODEL: z.string().min(1).default('anthropic/claude-sonnet-5.5'),
  LAB_HOST: z.string().min(1).default('127.0.0.1'),
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
