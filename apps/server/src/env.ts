import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const schema = z.object({
  BETTER_AUTH_SECRET: z.string().min(32),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  LAB_ADMIN_EMAIL: z.email(),
  LAB_ALLOWED_EMAILS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((pattern) => pattern.trim().toLowerCase())
        .filter(Boolean)
    ),
  LAB_CREDENTIALS_KEY: z.string().min(32).optional(),
  LAB_CREDENTIALS_KEY_PREVIOUS: z.string().min(32).optional(),
  LAB_COMPUTER_USERS: z.enum(['admin', 'everyone']).default('admin'),
  LAB_DEFAULT_MODEL: z.string().min(1).default('anthropic/claude-sonnet-5.5'),
  LAB_HOST: z.string().min(1).default('127.0.0.1'),
  LAB_MONTHLY_LIMIT: z.coerce.number().positive().optional(),
  LAB_ORIGIN: z.url(),
  LAB_REPOSITORY: z.string().min(1).default('terror/lab'),
  LAB_SANDBOX_PROVIDER: z.enum(['vercel']).optional(),
  LAB_STORAGE_LIMIT: z.coerce.number().positive().optional(),
  LAB_STORAGE_PATH: z
    .string()
    .min(1)
    .default(fileURLToPath(new URL('../../../lab.sqlite', import.meta.url))),
  RAILWAY_GIT_COMMIT_SHA: z.string().min(1).default('development'),
  SENTRY_DSN: z.url().optional(),
  VERCEL_PROJECT_ID: z.string().min(1).optional(),
  VERCEL_TEAM_ID: z.string().min(1).optional(),
  VERCEL_TOKEN: z.string().min(1).optional(),
});

const result = schema.safeParse(process.env);

if (!result.success) {
  throw new Error(
    `Invalid environment variables:\n${z.prettifyError(result.error)}`
  );
}

export const env = result.data;
