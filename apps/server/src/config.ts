import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const file = fileURLToPath(new URL('../../../.env', import.meta.url));

if (existsSync(file)) {
  loadEnvFile(file);
}

const postgresURL = z.url({ protocol: /^postgres(ql)?$/ });

const env = z
  .object({
    DATABASE_URL: postgresURL,
    WORKFLOW_POSTGRES_URL: postgresURL.optional(),
    LAB_ORIGIN: z.url({ protocol: /^https?$/ }),
    LAB_ADMIN_EMAIL: z.email().transform((email) => email.toLowerCase()),
    BETTER_AUTH_SECRET: z.string().min(32),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
  })
  .parse(Bun.env);

export const config = {
  databaseURL: env.DATABASE_URL,
  workflowURL: env.WORKFLOW_POSTGRES_URL ?? env.DATABASE_URL,
  origin: new URL(env.LAB_ORIGIN).origin,
  adminEmail: env.LAB_ADMIN_EMAIL,
  authSecret: env.BETTER_AUTH_SECRET,
  googleClientId: env.GOOGLE_CLIENT_ID,
  googleClientSecret: env.GOOGLE_CLIENT_SECRET,
};
